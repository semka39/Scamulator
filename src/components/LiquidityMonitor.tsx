import React, { useState, useEffect } from 'react';
import { WithdrawalRequestInfo, PastWithdrawal } from '../types';
import { Clock, AlertTriangle, ShieldCheck, History, CheckCircle2, Flame } from 'lucide-react';

interface LiquidityMonitorProps {
  activeWithdrawal: WithdrawalRequestInfo | null;
  pastWithdrawals: PastWithdrawal[];
  capital: number;
}

export const LiquidityMonitor: React.FC<LiquidityMonitorProps> = ({
  activeWithdrawal,
  pastWithdrawals,
  capital,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!activeWithdrawal) return;

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(activeWithdrawal.deadlineAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Таймаут истек (Готово к исполнению)');
      } else {
        const hours = Math.floor(diff / (1000 * 3600));
        const minutes = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}ч ${minutes}м ${seconds}с`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeWithdrawal]);

  const withdrawalRatio =
    activeWithdrawal && capital > 0 ? Math.round((activeWithdrawal.amount / capital) * 100) : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Очередь вывода
          </h3>
        </div>
      </div>

      {/* Active Withdrawal Queue */}
      {activeWithdrawal ? (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 mb-4 animate-in fade-in">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                Активная заявка на вывод
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-white bg-neutral-950/80 px-2.5 py-1 rounded-lg border border-amber-500/30">
              {activeWithdrawal.amount.toLocaleString()} ₽ ({withdrawalRatio}% банка)
            </span>
          </div>

          {activeWithdrawal.claimCollateralAndClose && (
            <div className="mb-3 px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Создатель запросил закрытие темки и забор залога!</span>
            </div>
          )}

          {/* Progress Bar of 10 deposits */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs text-neutral-300">
              <span>Новых ставок до вывода:</span>
              <strong className="font-mono text-amber-300">
                {activeWithdrawal.depositsSinceRequest} / 10 (Осталось: {activeWithdrawal.depositsRemaining})
              </strong>
            </div>
            <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (activeWithdrawal.depositsSinceRequest / 10) * 100)}%` }}
              />
            </div>
          </div>

          {/* Timeout info */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-amber-500/20 font-mono">
            <span>Альтернативное условие (таймаут 48ч):</span>
            <span className="text-amber-200 font-bold">{timeLeft}</span>
          </div>
        </div>
      ) : (
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5 mb-4 text-xs text-neutral-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Активных заявок на вывод нет — банк темки в безопасности.</span>
        </div>
      )}

      {/* Historical Past Withdrawals */}
      <div>
        <h4 className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5 mb-2.5">
          <History className="w-3.5 h-3.5 text-neutral-500" />
          История прошлых выводов создателя
        </h4>

        {pastWithdrawals.length === 0 ? (
          <p className="text-[11px] text-neutral-500 italic">История выводов пуста.</p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs font-mono">
            {pastWithdrawals.map((pw) => (
              <div
                key={pw.id}
                className="flex items-center justify-between bg-neutral-950/50 border border-neutral-800/60 px-3 py-1.5 rounded-lg text-neutral-300"
              >
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">-{pw.amount.toLocaleString()} ₽</span>
                  {pw.claimedCollateral && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                      Залог забран
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-neutral-500">
                  {new Date(pw.timestamp).toLocaleDateString()} {new Date(pw.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
