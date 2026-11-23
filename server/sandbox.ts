import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mutex queues per temka to ensure strict sequential FIFO execution
const temkaQueues = new Map<string, Promise<any>>();

export interface SandboxResult {
  payout: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
  error?: string;
}

export interface SimulationRoundResult {
  round: number;
  bet: number;
  payout: number;
  multiplier: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  capitalAfter: number;
}

export interface SimulationResult {
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
  payout: number;
  totalIn: number;
  totalOut: number;
  avgMultiplier: number;
  maxMultiplier: number;
  minMultiplier: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
  rounds: SimulationRoundResult[];
  finalState?: any;
}

export function getTemkaStateDir(temkaId: string): string {
  const dir = path.join(process.cwd(), 'data', 'temka_states', temkaId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function executePythonSandbox(
  temkaId: string,
  algorithmCode: string,
  amount: number,
  userIdHash: string,
  currentCapital: number
): Promise<SandboxResult> {
  // Enqueue execution behind previous runs for this temka (FIFO Mutex)
  const previousTask = temkaQueues.get(temkaId) || Promise.resolve();
  
  const currentTask = previousTask
    .catch(() => {}) // never fail chain if previous task had an error
    .then(() => runSingleSandbox(temkaId, algorithmCode, amount, userIdHash, currentCapital));

  temkaQueues.set(temkaId, currentTask);

  try {
    return await currentTask;
  } finally {
    // If this was the last task in the queue, clean up map entry
    if (temkaQueues.get(temkaId) === currentTask) {
      temkaQueues.delete(temkaId);
    }
  }
}

// Wrapper Python Script Builder
function buildPythonScript(
  algorithmCode: string,
  stateFilePath: string,
  amount: number,
  userIdHash: string,
  currentCapital: number
): string {
  const normalizedCode = (algorithmCode || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const hasHandleDeposit = /def\s+handle_deposit\s*\(/.test(normalizedCode);

  let formattedUserCode = '';
  if (hasHandleDeposit) {
    formattedUserCode = normalizedCode;
  } else {
    // Indent user code into a handle_deposit function
    const indented = normalizedCode
      .split('\n')
      .map((line) => (line.trim() ? '    ' + line : line))
      .join('\n');
    formattedUserCode = `def handle_deposit(amount, user_id, current_capital):
${indented}
    if 'payout' in locals():
        return locals()['payout']
    return amount`;
  }

  return `import sys
import json
import math
import random
import time
import datetime
import hashlib
import os
import inspect

STATE_FILE = ${JSON.stringify(stateFilePath)}

def load_state():
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return {}
                return json.loads(content)
        return {}
    except Exception:
        return {}

def save_state(data):
    try:
        if not isinstance(data, dict):
            raise TypeError("State must be a dict/object")
        serialized = json.dumps(data, ensure_ascii=False)
        if len(serialized.encode('utf-8')) > 3 * 1024 * 1024:
            raise ValueError("State exceeded 3MB limit")
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            f.write(serialized)
    except Exception as e:
        sys.stderr.write(f"State Save Error: {e}\\n")
        raise

# User algorithm definition
${formattedUserCode}

# Invocation block
if __name__ == '__main__':
    try:
        deposit_amount = int(${Math.floor(amount)})
        deposit_user_id = ${JSON.stringify(userIdHash)}
        deposit_capital = int(${Math.floor(currentCapital)})

        # Dynamically invoke handle_deposit with correct argument count
        fn = None
        if 'handle_deposit' in globals():
            fn = globals()['handle_deposit']
        elif 'handle_deposit' in locals():
            fn = locals()['handle_deposit']

        if fn is None or not callable(fn):
            raise NameError("Function 'handle_deposit' is not defined")

        sig = inspect.signature(fn)
        param_count = len(sig.parameters)
        has_varargs = any(p.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD) for p in sig.parameters.values())

        if has_varargs or param_count >= 3:
            res = fn(deposit_amount, deposit_user_id, deposit_capital)
        elif param_count == 2:
            res = fn(deposit_amount, deposit_user_id)
        elif param_count == 1:
            res = fn(deposit_amount)
        else:
            res = fn()

        if res is None:
            payout = 0
        elif isinstance(res, (int, float)):
            payout = int(res)
        else:
            raise TypeError(f"Payout must be a number, got {type(res).__name__}")

        if payout < 0:
            raise ValueError("Payout cannot be negative")

        sys.stdout.flush()
        sys.stderr.flush()
        print(f"__RESULT_PAYOUT__:{payout}")

    except Exception as e:
        sys.stderr.write(f"Execution Error: {str(e)}\\n")
        sys.exit(1)
`;
}

async function runSingleSandbox(
  temkaId: string,
  algorithmCode: string,
  amount: number,
  userIdHash: string,
  currentCapital: number,
  customStateDir?: string
): Promise<SandboxResult> {
  const startTime = Date.now();
  const stateDir = customStateDir || getTemkaStateDir(temkaId);
  const stateFilePath = path.join(stateDir, 'state.json');
  const tempStateFilePath = path.join(stateDir, `temp_state_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.json`);

  // Ensure state.json exists
  if (!fs.existsSync(stateFilePath)) {
    fs.writeFileSync(stateFilePath, JSON.stringify({}, null, 2), 'utf-8');
  }

  // Copy state to temp state file for atomic rollback
  try {
    fs.copyFileSync(stateFilePath, tempStateFilePath);
  } catch (e) {
    fs.writeFileSync(tempStateFilePath, '{}', 'utf-8');
  }

  const runnerFilePath = path.join(stateDir, `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`);
  const runnerScript = buildPythonScript(algorithmCode, tempStateFilePath, amount, userIdHash, currentCapital);
  fs.writeFileSync(runnerFilePath, runnerScript, 'utf-8');

  return new Promise<SandboxResult>((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let isDone = false;

    const cleanupAll = () => {
      cleanupTemp(runnerFilePath);
      cleanupTemp(tempStateFilePath);
    };

    const child = spawn('python3', ['-u', runnerFilePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PYTHONUNBUFFERED: '1', PATH: process.env.PATH },
    });

    const timeoutTimer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {}
        cleanupAll();
        const duration = Date.now() - startTime;
        resolve({
          payout: 0,
          stdout: stdoutData,
          stderr: stderrData + '\n[Лимит времени] Превышен лимит времени выполнения (4.0 сек)',
          durationMs: duration,
          status: 'TIMEOUT',
          error: 'Превышен лимит времени выполнения скрипта (4.0 сек)',
        });
      }
    }, 4000);

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
    }

    child.on('error', (err) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timeoutTimer);
      cleanupAll();
      const duration = Date.now() - startTime;
      resolve({
        payout: 0,
        stdout: stdoutData,
        stderr: stderrData + `\nProcess error: ${err.message}`,
        durationMs: duration,
        status: 'ERROR',
        error: err.message,
      });
    });

    child.on('close', (code) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timeoutTimer);
      const duration = Date.now() - startTime;

      if (code !== 0) {
        cleanupAll();
        resolve({
          payout: 0,
          stdout: stdoutData,
          stderr: stderrData,
          durationMs: duration,
          status: 'ERROR',
          error: stderrData.trim() || `Скрипт завершился с кодом ошибки ${code}`,
        });
        return;
      }

      // Parse result payout
      const match = stdoutData.match(/__RESULT_PAYOUT__:(\d+)/);
      if (!match) {
        cleanupAll();
        resolve({
          payout: 0,
          stdout: stdoutData,
          stderr: stderrData + '\nНе удалось извлечь итоговую выплату из вывода',
          durationMs: duration,
          status: 'ERROR',
          error: stderrData.trim() || 'Алгоритм не вернул числовое значение выплаты',
        });
        return;
      }

      const payout = parseInt(match[1], 10);
      const cleanStdout = stdoutData.replace(/__RESULT_PAYOUT__:\d+\n?/, '');

      // Commit state atomically!
      try {
        if (fs.existsSync(tempStateFilePath)) {
          const stats = fs.statSync(tempStateFilePath);
          if (stats.size <= 3 * 1024 * 1024) {
            fs.copyFileSync(tempStateFilePath, stateFilePath);
          }
          cleanupAll();
        }
      } catch (e) {
        console.error('Failed to commit state.json:', e);
        cleanupAll();
      }

      resolve({
        payout,
        stdout: cleanStdout,
        stderr: stderrData,
        durationMs: duration,
        status: 'SUCCESS',
      });
    });
  });
}

/**
 * Isolated Simulation Runner
 * Runs one or multiple rounds in an ephemeral directory without modifying real database state.
 */
export async function simulatePythonSandbox(
  algorithmCode: string,
  testBet: number = 100,
  initialCapital: number = 5000,
  roundsCount: number = 1
): Promise<SimulationResult> {
  const simId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const simDir = path.join(os.tmpdir(), 'temka_simulations', simId);

  fs.mkdirSync(simDir, { recursive: true });
  fs.writeFileSync(path.join(simDir, 'state.json'), JSON.stringify({}, null, 2), 'utf-8');

  const rounds: SimulationRoundResult[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let currentCap = Math.max(100, initialCapital);
  let totalDuration = 0;
  let allStdout = '';
  let allStderr = '';

  const cleanSimDir = () => {
    try {
      if (fs.existsSync(simDir)) {
        fs.rmSync(simDir, { recursive: true, force: true });
      }
    } catch (e) {}
  };

  const roundsToRun = Math.min(Math.max(1, roundsCount), 20);

  try {
    for (let i = 1; i <= roundsToRun; i++) {
      const userHash = `test_trader_${(i % 3) + 1}`;
      const bet = Math.max(1, testBet);
      totalIn += bet;
      currentCap += bet;

      const roundRes = await runSingleSandbox(
        simId,
        algorithmCode,
        bet,
        userHash,
        currentCap,
        simDir
      );

      totalDuration += roundRes.durationMs;
      if (roundRes.stdout) allStdout += (allStdout ? '\n' : '') + `[Раунд ${i}]: ` + roundRes.stdout.trim();
      if (roundRes.stderr) allStderr += (allStderr ? '\n' : '') + `[Раунд ${i}]: ` + roundRes.stderr.trim();

      if (roundRes.status !== 'SUCCESS') {
        cleanSimDir();
        return {
          status: roundRes.status,
          payout: 0,
          totalIn,
          totalOut,
          avgMultiplier: totalIn > 0 ? Math.round((totalOut / totalIn) * 100) / 100 : 0,
          maxMultiplier: 0,
          minMultiplier: 0,
          durationMs: totalDuration,
          stdout: allStdout,
          stderr: allStderr,
          error: roundRes.error || roundRes.stderr || 'Ошибка выполнения в раунде ' + i,
          rounds,
        };
      }

      const payout = roundRes.payout;
      totalOut += payout;
      currentCap = Math.max(0, currentCap - payout);
      const mult = bet > 0 ? Math.round((payout / bet) * 100) / 100 : 0;

      rounds.push({
        round: i,
        bet,
        payout,
        multiplier: mult,
        stdout: roundRes.stdout,
        stderr: roundRes.stderr,
        durationMs: roundRes.durationMs,
        capitalAfter: currentCap,
      });
    }

    // Read final state
    let finalState = {};
    try {
      const stateContent = fs.readFileSync(path.join(simDir, 'state.json'), 'utf-8');
      finalState = JSON.parse(stateContent);
    } catch (e) {}

    cleanSimDir();

    const multipliers = rounds.map((r) => r.multiplier);
    const maxMult = multipliers.length > 0 ? Math.max(...multipliers) : 0;
    const minMult = multipliers.length > 0 ? Math.min(...multipliers) : 0;
    const avgMult = totalIn > 0 ? Math.round((totalOut / totalIn) * 100) / 100 : 0;

    return {
      status: 'SUCCESS',
      payout: totalOut,
      totalIn,
      totalOut,
      avgMultiplier: avgMult,
      maxMultiplier: maxMult,
      minMultiplier: minMult,
      durationMs: totalDuration,
      stdout: allStdout,
      stderr: allStderr,
      rounds,
      finalState,
    };
  } catch (err: any) {
    cleanSimDir();
    return {
      status: 'ERROR',
      payout: 0,
      totalIn,
      totalOut,
      avgMultiplier: 0,
      maxMultiplier: 0,
      minMultiplier: 0,
      durationMs: totalDuration,
      stdout: allStdout,
      stderr: allStderr,
      error: err.message || 'Ошибка запуска симуляции',
      rounds,
    };
  }
}

function cleanupTemp(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {}
}
