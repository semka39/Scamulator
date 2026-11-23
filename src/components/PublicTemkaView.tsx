import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Temka, User, TransactionSummary, WithdrawalRequestInfo, PastWithdrawal, Comment } from '../types';
import { LiquidityMonitor } from './LiquidityMonitor';
import { CoefficientFeed } from './CoefficientFeed';
import { ProofOfBetComments } from './ProofOfBetComments';
import { TemkaCharts } from './TemkaCharts';
import { BetResultModal } from './BetResultModal';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Coins,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Lock,
  Flame,
  User as UserIcon,
  RefreshCw,
  Zap,
  Code2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Layers,
  Activity,
} from 'lucide-react';

interface PublicTemkaViewProps {
  temkaId: string;
  currentUser: User | null;
  onBack: () => void;
  onViewAuthor: (authorId: string) => void;
  onUserBalanceUpdated?: (newBalance: number) => void;
}

export const PublicTemkaView: React.FC<PublicTemkaViewProps> = ({
  temkaId,
  currentUser,
  onBack,
  onViewAuthor,
  onUserBalanceUpdated,
}) => {
  const [data, setData] = useState<{
    temka: Temka;
    activeWithdrawal: WithdrawalRequestInfo | null;
    pastWithdrawals: PastWithdrawal[];
    transactions: TransactionSummary[];
    userContext: {
      isOwner: boolean;
      canBet: boolean;
      hasUserDeposited: boolean;
      userStats: any;
    };
  } | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  // Bet Form & Popup modal state
  const [betAmount, setBetAmount] = useState<number>(0);
  const [isSubmittingBet, setIsSubmittingBet] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [betResult, setBetResult] = useState<{
    payout: number;
    multiplier: number;
    isDefault: boolean;
    isRefund: boolean;
    message: string;
    stdout?: string;
  } | null>(null);

  const fetchTemka = async () => {
    try {
      const res = await api.getTemkaDetails(temkaId);
      setData(res);
      setBetAmount((prev) => (prev > 0 ? prev : (res.temka.minBet || 10)));
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки темки');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.getComments(temkaId);
      setComments(res.comments);
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  };

  useEffect(() => {
    fetchTemka();
    fetchComments();

    let consecutiveErrors = 0;
    const interval = setInterval(() => {
      // Pause polling if user switched tab or app is backgrounded
      if (document.hidden) return;
      if (consecutiveErrors >= 3) return; // Prevent flooding if offline

      fetchTemka().catch(() => {
        consecutiveErrors++;
      });
    }, 5000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        consecutiveErrors = 0;
        fetchTemka();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [temkaId]);

  const handleBet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!data) return;

    setModalError(null);
    setBetResult(null);
    setIsSubmittingBet(true);
    setIsModalOpen(true);

    try {
      const res = await api.makeBet(temkaId, betAmount);
      setBetResult({
        payout: res.payout,
        multiplier: res.transaction.multiplier,
        isDefault: res.isDefault,
        isRefund: res.isRefund,
        message: res.message,
        stdout: res.stdout,
        stderr: res.stderr,
      });

      if (onUserBalanceUpdated) {
        onUserBalanceUpdated(res.userBalance);
      }

      // Win celebration
      if (res.payout >= betAmount && !res.isRefund && !res.isDefault) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      }

      fetchTemka();
      fetchComments();
    } catch (err: any) {
      setModalError(err.message || 'Не удалось совершить ставку');
    } finally {
      setIsSubmittingBet(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-28">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Темка не найдена</h3>
        <p className="text-xs text-neutral-400 mb-6">{error || 'Проект был удален или недоступен'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const { temka, activeWithdrawal, pastWithdrawals, transactions, userContext } = data;
  const isOwner = userContext.isOwner;
  const rtp = temka.totalIn > 0 ? Math.round((temka.totalOut / temka.totalIn) * 1000) / 10 : 0;

  const statusConfig = {
    Active: {
      label: 'Активный смарт-контракт',
      bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400 animate-pulse',
    },
    Bankrupt: {
      label: 'Обанкрочен',
      bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      dot: 'bg-rose-400',
    },
    Closed: {
      label: 'Закрыт автором',
      bg: 'bg-neutral-800 text-neutral-400 border-neutral-700',
      dot: 'bg-neutral-500',
    },
  }[temka.status];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150">
      {/* Top Bar: Back button + Title & Author */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 sm:p-5 shadow-xl">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0"
            title="Назад к каталогу"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bg}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {statusConfig.label}
              </span>
              <span className="text-xs text-neutral-500 font-mono">
                Создан: {new Date(temka.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {temka.title}
            </h1>
          </div>
        </div>

        {/* Author preview badge */}
        <button
          onClick={() => onViewAuthor(temka.ownerId)}
          className="flex items-center gap-2.5 sm:gap-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 rounded-xl p-2.5 transition-all self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          {temka.ownerAvatarUrl ? (
            <img
              src={temka.ownerAvatarUrl}
              alt={temka.ownerUsername}
              className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-500/40 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
              {temka.ownerUsername.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <span className="text-[10px] uppercase font-mono text-neutral-500 block">Автор схемы</span>
            <span className="text-xs font-bold text-white font-mono flex items-center gap-1">
              @{temka.ownerUsername}
            </span>
          </div>
        </button>
      </div>

      {/* Dynamic Telemetry Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {/* Capital */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block mb-1">
            Пул ликвидности
          </span>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-black font-mono text-emerald-400">
            <Coins className="w-4 h-4 shrink-0" />
            <span className="truncate">{temka.capital.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* Collateral */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block mb-1">
            Залог создателя
          </span>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-black font-mono text-amber-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">{temka.collateral.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* RTP */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block mb-1">
            RTP / Доходность
          </span>
          <div
            className={`flex items-center gap-1.5 text-sm sm:text-lg font-black font-mono ${
              rtp >= 100 ? 'text-emerald-400' : rtp >= 75 ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>{rtp}%</span>
          </div>
        </div>

        {/* Total In */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block mb-1">
            Внесено игроками
          </span>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-black font-mono text-neutral-200">
            <Layers className="w-4 h-4 shrink-0 text-sky-400" />
            <span className="truncate">{temka.totalIn.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* Total Out */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block mb-1">
            Выплачено игрокам
          </span>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-black font-mono text-purple-400">
            <Flame className="w-4 h-4 shrink-0" />
            <span className="truncate">{temka.totalOut.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* Deals Count */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block mb-1">
            Количество ставок
          </span>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-black font-mono text-white">
            <Activity className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{temka.dealsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Bet Action + Description + Liquidity Monitor) | Right Column (Charts + Live Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. Interactive Bet Form / Creator Panel */}
          <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Сделать ставку
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                Исполнение в Python 3.10
              </span>
            </div>

            {/* OWNER LOCK */}
            {isOwner ? (
              <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-xl text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>БЛОКИРОВКА СОЗДАТЕЛЯ</span>
                </div>
                <p className="leading-relaxed text-amber-200/90">
                  Вы являетесь автором этой темки. Согласно архитектуре платформы, автор не может совершать ставки в собственный смарт-контракт.
                </p>
              </div>
            ) : temka.status !== 'Active' ? (
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-400 flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Прием ставок закрыт. Статус темки: {temka.status}.</span>
              </div>
            ) : !currentUser ? (
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-400 text-center">
                Войдите в аккаунт, чтобы делать ставки в этот смарт-контракт.
              </div>
            ) : (
              <form onSubmit={handleBet} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="font-semibold text-neutral-300">
                      Сумма ставки (₽)
                    </label>
                    <span className="font-mono text-neutral-400 text-[11px]">
                      Лимиты: {temka.minBet} — {temka.maxBet} ₽
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min={temka.minBet}
                      max={temka.maxBet}
                      value={betAmount || ''}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-lg font-mono font-bold text-white focus:outline-hidden focus:border-amber-500 transition-colors"
                    />
                    <div className="absolute right-3 top-3.5 text-xs font-mono text-neutral-400 font-bold">
                      RUB
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    temka.minBet,
                    Math.round(temka.minBet * 2),
                    Math.round((temka.minBet + temka.maxBet) / 2),
                    temka.maxBet,
                  ]
                    .filter((v, i, arr) => arr.indexOf(v) === i && v <= temka.maxBet)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBetAmount(preset)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                          betAmount === preset
                            ? 'bg-amber-500 text-neutral-950 border-amber-400'
                            : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {preset.toLocaleString()} ₽
                      </button>
                    ))}
                </div>

                {/* Bet Submit Button */}
                <button
                  type="submit"
                  disabled={
                    isSubmittingBet ||
                    betAmount < temka.minBet ||
                    betAmount > temka.maxBet ||
                    currentUser.balance < betAmount
                  }
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-neutral-950 font-black text-sm font-mono rounded-xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-neutral-950" />
                  <span>
                    {currentUser.balance < betAmount
                      ? `Недостаточно средств (${currentUser.balance.toLocaleString()} ₽)`
                      : `Сделать ставку: ${betAmount.toLocaleString()} ₽`}
                  </span>
                </button>
              </form>
            )}
          </div>

          {/* 2. Description */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs uppercase font-mono tracking-wider text-neutral-400">
              Описание финансовой схемы
            </h3>
            <p className="text-sm text-neutral-300 leading-relaxed">{temka.description}</p>

            {/* Python Code Toggle (Visible ONLY to the creator of this temka) */}
            {data.userContext.isOwner && temka.algorithmCode && (
              <div className="pt-3 border-t border-neutral-800/80">
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="flex items-center justify-between w-full text-xs font-mono text-amber-400/90 hover:text-amber-300 py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showCode ? 'Скрыть код алгоритма' : 'Исходный код (виден только вам как автору)'}</span>
                  </span>
                  {showCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showCode && (
                  <div className="mt-2.5 p-3 bg-neutral-950 border border-neutral-800 rounded-xl overflow-x-auto">
                    <div className="text-[11px] font-mono text-neutral-500 mb-1.5 pb-1 border-b border-neutral-900 flex items-center justify-between">
                      <span>Python Smart Contract</span>
                      <span className="text-amber-400/80">Private Source</span>
                    </div>
                    <pre className="text-xs font-mono text-neutral-300 leading-relaxed">
                      {temka.algorithmCode}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Liquidity Monitor & Withdrawal Queue */}
          <LiquidityMonitor
            activeWithdrawal={activeWithdrawal}
            pastWithdrawals={pastWithdrawals}
            capital={temka.capital}
          />
        </div>

        {/* Right Column (6 cols): Charts & Live Multipliers Feed */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. Interactive Visual Analytics Charts */}
          <TemkaCharts temka={temka} transactions={transactions} />

          {/* 2. Live K-Feed */}
          <CoefficientFeed transactions={transactions} />
        </div>
      </div>

      {/* Bottom Section (Full Width Across Entire Screen): Discussion & Reviews */}
      <div className="w-full pt-2">
        <ProofOfBetComments
          temkaId={temka.id}
          comments={comments}
          currentUser={currentUser}
          hasUserDeposited={userContext.hasUserDeposited}
          userStats={userContext.userStats}
          onCommentsUpdated={fetchComments}
          onViewAuthor={onViewAuthor}
        />
      </div>

      {/* Bet Result Popup Modal */}
      <BetResultModal
        isOpen={isModalOpen}
        isLoading={isSubmittingBet}
        betAmount={betAmount}
        result={betResult}
        error={modalError}
        onClose={() => setIsModalOpen(false)}
        onBetAgain={() => handleBet()}
      />
    </div>
  );
};
