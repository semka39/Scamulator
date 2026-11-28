import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User, Temka, SimulationResult, TemkaClonePayload } from '../types';
import {
  X,
  Code2,
  Coins,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Play,
  Terminal,
  CheckCircle2,
  RefreshCw,
  Gauge,
  Sliders,
  ChevronDown,
  ChevronUp,
  FileCode,
  Zap,
} from 'lucide-react';

interface CreateTemkaModalProps {
  isOpen: boolean;
  currentUser: User | null;
  cloneData?: TemkaClonePayload | null;
  onClose: () => void;
  onSuccess: (temka: Temka) => void;
}

export const CreateTemkaModal: React.FC<CreateTemkaModalProps> = ({
  isOpen,
  currentUser,
  cloneData,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [initialCapital, setInitialCapital] = useState<number>(5000);
  const [collateral, setCollateral] = useState<number>(3000);
  const [minBet, setMinBet] = useState<number>(100);
  const [maxBet, setMaxBet] = useState<number>(2000);

  const ALGORITHM_TEMPLATES = [
    {
      name: 'Квантовый маркет-мейкер (RTP 106%)',
      code: `# Квантовый алгоритм с накопительной лояльностью
state = load_state()
user_history = state.get(user_id, {"count": 0, "total": 0})
user_history["count"] += 1
user_history["total"] += amount
state[user_id] = user_history

# Прогрессивный множитель от 1.05 до 1.25
bonus = min(user_history["count"] * 0.02, 0.15)
multiplier = 1.06 + random.uniform(-0.04, 0.08) + bonus

save_state(state)
return int(amount * multiplier)`,
    },
    {
      name: 'Пирамида Понци с накопительным Джекпотом',
      code: `# Пирамида с накопительным банком джекпота
state = load_state()
jackpot = state.get("jackpot", 500)

state["jackpot"] = jackpot + int(amount * 0.08)
multiplier = 1.10

# 20% шанс сорвать джекпот
if random.random() < 0.20 and state["jackpot"] > 200:
    win_bonus = int(state["jackpot"] * 0.5)
    state["jackpot"] -= win_bonus
    print(f"Jackpot won: {win_bonus}")
    save_state(state)
    return int(amount * multiplier) + win_bonus

save_state(state)
return int(amount * multiplier)`,
    },
    {
      name: 'Высоковолатильная Рулетка 50/50',
      code: `# Рулетка с шансом удвоения
roll = random.random()
if roll > 0.48:
    # Игрок побеждает
    return int(amount * 1.85)
else:
    # Защитный срез
    return int(amount * 0.20)`,
    },
    {
      name: 'Мясорубка (Срез 70% в темку)',
      code: `# Агрессивный сбор банка темки
roll = random.randint(1, 100)
if roll >= 90:
    return int(amount * 2.50)
elif roll >= 70:
    return int(amount * 1.00)
else:
    return int(amount * 0.30)`,
    },
  ];

  const [algorithmCode, setAlgorithmCode] = useState<string>(ALGORITHM_TEMPLATES[0].code);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sandbox Testing State
  const [testing, setTesting] = useState(false);
  const [simRounds, setSimRounds] = useState<number>(5);
  const [testBetAmount, setTestBetAmount] = useState<number>(100);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [showSimDetails, setShowSimDetails] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSimResult(null);
    if (cloneData) {
      setTitle(cloneData.title);
      setDescription(cloneData.description);
      setAlgorithmCode(cloneData.algorithmCode || ALGORITHM_TEMPLATES[0].code);
      setInitialCapital(cloneData.initialCapital);
      setCollateral(cloneData.collateral);
      setMinBet(cloneData.minBet);
      setMaxBet(cloneData.maxBet);
    }
  }, [isOpen, cloneData]);

  if (!isOpen) return null;

  const totalRequired = Number(initialCapital || 0) + Number(collateral || 0);

  const handleTestAlgorithm = async () => {
    setTesting(true);
    setError(null);
    setSimResult(null);

    try {
      const res = await api.testAlgorithm({
        algorithmCode,
        betAmount: Number(testBetAmount) || minBet || 100,
        initialCapital: Number(initialCapital) || 5000,
        rounds: simRounds,
      });

      setSimResult(res);
      setShowSimDetails(true);
    } catch (err: any) {
      setError(err.message || 'Ошибка тестирования алгоритма');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (currentUser.balance < totalRequired) {
      setError(`Недостаточно средств. Ваш баланс: ${currentUser.balance} ₽. Требуется: ${totalRequired} ₽.`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.createTemka({
        title,
        description,
        algorithmCode,
        collateral: Number(collateral),
        initialCapital: Number(initialCapital),
        minBet: Number(minBet),
        maxBet: Number(maxBet),
      });

      onSuccess(res.temka);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска темки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl max-h-[94vh] rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Конструктор темки
              </h2>
              <p className="text-xs text-neutral-400 hidden sm:block">
                Создайте свою темку и задайте правила выплат на Python
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-xl transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Title & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">
                Название темки <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Удвоитель 2000"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">
                Краткое описание механики <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: Темка с прогрессивным кэшбэком и защитой от крупных ставок"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Financial Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div>
              <label className="block text-neutral-400 font-medium mb-1">
                Стартовый капитал (₽)
              </label>
              <input
                type="number"
                min="100"
                required
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white font-mono font-bold"
              />
              <span className="text-[10px] text-neutral-500 mt-0.5 block">Банк для выплат</span>
            </div>

            <div>
              <label className="block text-neutral-400 font-medium mb-1">
                Залог создателя (₽)
              </label>
              <input
                type="number"
                min="100"
                required
                value={collateral}
                onChange={(e) => setCollateral(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-amber-300 font-mono font-bold"
              />
              <span className="text-[10px] text-neutral-500 mt-0.5 block">Страховка дефолта</span>
            </div>

            <div>
              <label className="block text-neutral-400 font-medium mb-1">
                Мин. ставка (Min Bet)
              </label>
              <input
                type="number"
                min="1"
                required
                value={minBet}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMinBet(val);
                  if (testBetAmount < val) setTestBetAmount(val);
                }}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-neutral-400 font-medium mb-1">
                Макс. ставка (Max Bet)
              </label>
              <input
                type="number"
                min={minBet || 1}
                required
                value={maxBet}
                onChange={(e) => setMaxBet(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white font-mono"
              />
            </div>
          </div>

          {/* Python Algorithm Editor */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-amber-400" />
                Код темки (Python)
              </label>

              {/* Template selector */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-neutral-500">Шаблоны:</span>
                {ALGORITHM_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAlgorithmCode(tmpl.code);
                      setSimResult(null);
                    }}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {tmpl.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative font-mono">
              <textarea
                rows={7}
                required
                value={algorithmCode}
                onChange={(e) => {
                  setAlgorithmCode(e.target.value);
                  setSimResult(null);
                }}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3.5 text-xs text-amber-200 focus:outline-hidden focus:border-amber-500 font-mono leading-relaxed resize-y"
              />
            </div>

            {/* Sandbox Testing / Simulation Panel */}
            <div className="mt-3 bg-neutral-950/90 border border-neutral-800 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">Тест кода перед запуском</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-neutral-400">Ставка:</span>
                    <input
                      type="number"
                      min="1"
                      value={testBetAmount}
                      onChange={(e) => setTestBetAmount(Number(e.target.value))}
                      className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                    />
                    <span className="text-[11px] text-neutral-500">₽</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-neutral-400">Раундов:</span>
                    {[1, 5, 10].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSimRounds(r)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          simRounds === r
                            ? 'bg-amber-500 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleTestAlgorithm}
                    disabled={testing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 font-bold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Тестирование...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Протестировать</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Simulation Result Preview */}
              {simResult && (
                <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
                  simResult.status === 'SUCCESS'
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-neutral-200'
                    : 'bg-red-950/30 border-red-800/60 text-red-300'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {simResult.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="font-bold">
                        {simResult.status === 'SUCCESS' ? 'Тест пройден успешно' : 'Ошибка выполнения'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px]">
                      <span>Длительность: <strong className="text-white">{simResult.durationMs} мс</strong></span>
                      {simResult.status === 'SUCCESS' && (
                        <>
                          <span>Средний множитель: <strong className="text-amber-300">{simResult.avgMultiplier}x</strong></span>
                          <span>Всего выплат: <strong className="text-emerald-400">{simResult.totalOut.toLocaleString()} ₽</strong></span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowSimDetails(!showSimDetails)}
                        className="text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        <span>{showSimDetails ? 'Скрыть логи' : 'Подробнее'}</span>
                        {showSimDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {simResult.error && (
                    <div className="mt-2 text-red-400 bg-red-950/50 p-2 rounded border border-red-900/50">
                      {simResult.error}
                    </div>
                  )}

                  {showSimDetails && simResult.rounds && simResult.rounds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                      <div className="text-[11px] text-neutral-400 font-bold">Раунды симуляции:</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {simResult.rounds.map((r) => (
                          <div key={r.round} className="flex items-center justify-between text-[10px] bg-neutral-900/80 px-2 py-1 rounded">
                            <span>Раунд #{r.round}: ставка {r.bet} ₽ &rarr; выплата <strong className="text-emerald-300">{r.payout} ₽ ({r.multiplier}x)</strong></span>
                            <span className="text-neutral-500">{r.durationMs} мс | Капитал: {r.capitalAfter} ₽</span>
                          </div>
                        ))}
                      </div>

                      {simResult.stdout && (
                        <div className="mt-2">
                          <div className="text-[10px] text-neutral-400 mb-1">Вывод stdout:</div>
                          <pre className="bg-black/60 p-2 rounded text-[10px] text-neutral-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                            {simResult.stdout}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sandbox Rules Guide */}
              <div className="text-[11px] text-neutral-400 space-y-1 font-mono">
                <div>• Точка входа: <code>handle_deposit(amount: int, user_id: str, current_capital: int) &rarr; int</code></div>
                <div>• Состояние (Persistent): <code>load_state() &rarr; dict</code>, <code>save_state(data: dict)</code> (до 3 МБ)</div>
                <div>• Лимиты: RAM 64 МБ, Timeout 4.0 секунды, полная изоляция среды</div>
              </div>
            </div>
          </div>

          {/* Summary & Submit Bar */}
          <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-neutral-400">
              С баланса спишется:{' '}
              <strong className="text-white font-mono font-bold">{totalRequired.toLocaleString()} ₽</strong>{' '}
              (Капитал {initialCapital} ₽ + Залог {collateral} ₽)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={loading || testing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loading ? 'Проверка и запуск...' : 'Запустить темку'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
