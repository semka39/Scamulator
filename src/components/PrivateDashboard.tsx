import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Temka, User, CreatorMetrics, BalanceHistoryItem, BalanceCategory, BalanceDirection, TemkaClonePayload } from '../types';
import { SandboxLogsModal } from './SandboxLogsModal';
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Clock,
  AlertTriangle,
  Edit3,
  Terminal,
  ArrowDownToLine,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Eye,
  Sliders,
  Sparkles,
  Zap,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Search,
  Filter,
  Layers,
  ChevronDown,
  X,
  Copy,
} from 'lucide-react';

interface PrivateDashboardProps {
  currentUser: User;
  onNavigateTemka: (temkaId: string) => void;
  onOpenCreateModal: () => void;
  onCloneTemka?: (cloneData: TemkaClonePayload) => void;
  onOpenDepositModal?: () => void;
  onOpenTransferModal?: () => void;
  onUserBalanceUpdated: (newBalance: number) => void;
}

interface ActiveWithdrawalBannerItemProps {
  temkaId: string;
  activeReq: any;
  onCancel: (temkaId: string) => void;
  onTimerExpired: () => void;
}

const ActiveWithdrawalBannerItem: React.FC<ActiveWithdrawalBannerItemProps> = ({
  temkaId,
  activeReq,
  onCancel,
  onTimerExpired,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!activeReq?.deadlineAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(activeReq.deadlineAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Исполняется автоматически...');
        onTimerExpired();
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
  }, [activeReq?.deadlineAt]);

  return (
    <div className="mt-4 p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-amber-300 font-bold">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Заявка на вывод в обработке: {activeReq.amount.toLocaleString()} ₽
            {activeReq.claimCollateralAndClose ? ' (+ залог и закрытие)' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-400 font-mono text-[11px]">
          <span>Депозиты: {activeReq.depositsSinceRequest || 0}/10</span>
          <span>•</span>
          <span>
            Автовывод через: <strong className="text-amber-200">{timeLeft}</strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onCancel(temkaId)}
          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-300 font-medium rounded-lg transition-colors cursor-pointer min-h-[36px]"
        >
          Отменить заявку
        </button>
      </div>
    </div>
  );
};

export const PrivateDashboard: React.FC<PrivateDashboardProps> = ({
  currentUser,
  onNavigateTemka,
  onOpenCreateModal,
  onCloneTemka,
  onOpenDepositModal,
  onOpenTransferModal,
  onUserBalanceUpdated,
}) => {
  const [data, setData] = useState<{
    user: User;
    metrics: CreatorMetrics;
    myTemkas: Temka[];
    activeWithdrawalRequests: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Action states
  const [activeLogsTemka, setActiveLogsTemka] = useState<{ id: string; title: string } | null>(null);
  const [topUpModal, setTopUpModal] = useState<{ id: string; title: string } | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);

  const [withdrawalModal, setWithdrawalModal] = useState<{ id: string; title: string; capital: number } | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [claimCollateral, setClaimCollateral] = useState<boolean>(false);

  const [editModal, setEditModal] = useState<{ id: string; title: string; description: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const hasSubModal = Boolean(topUpModal || withdrawalModal || editModal || activeLogsTemka);

  // Support browser Back button when a dashboard sub-modal is open
  useEffect(() => {
    if (!hasSubModal) return;

    window.history.pushState({ ...window.history.state, subModal: 'dashboardModal' }, '');

    const handlePopDashboardModal = () => {
      setTopUpModal(null);
      setWithdrawalModal(null);
      setEditModal(null);
      setActiveLogsTemka(null);
    };

    window.addEventListener('popstate', handlePopDashboardModal, { once: true });
    return () => {
      window.removeEventListener('popstate', handlePopDashboardModal);
    };
  }, [hasSubModal]);

  const closeDashboardModals = () => {
    setTopUpModal(null);
    setWithdrawalModal(null);
    setEditModal(null);
    setActiveLogsTemka(null);
    if (window.history.state?.subModal === 'dashboardModal') {
      window.history.back();
    }
  };

  // Balance History State
  const [historyItems, setHistoryItems] = useState<BalanceHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [directionFilter, setDirectionFilter] = useState<BalanceDirection>('all');
  const [categoryFilter, setCategoryFilter] = useState<BalanceCategory>('all');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyVisibleCount, setHistoryVisibleCount] = useState<number>(20);

  const fetchDashboard = async () => {
    try {
      const res = await api.getPrivateDashboard();
      setData(res);
      if (res.user && onUserBalanceUpdated) {
        onUserBalanceUpdated(res.user.balance);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки кабинета');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getBalanceHistory();
      setHistoryItems(res.items);
    } catch (err: any) {
      console.error('Failed to load balance history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchHistory();
  }, [currentUser.id]);

  useEffect(() => {
    if (!data?.activeWithdrawalRequests || data.activeWithdrawalRequests.length === 0) return;

    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchDashboard();
    }, 4000);

    return () => clearInterval(interval);
  }, [data?.activeWithdrawalRequests?.length]);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpModal) return;
    setError(null);
    try {
      const res = await api.topUpCapital(topUpModal.id, topUpAmount);
      setSuccessMsg(res.message);
      closeDashboardModals();
      fetchDashboard();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalModal) return;
    setError(null);
    try {
      const res = await api.createWithdrawalRequest(withdrawalModal.id, withdrawAmount, claimCollateral);
      setSuccessMsg(res.message);
      closeDashboardModals();
      fetchDashboard();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelWithdrawal = async (temkaId: string) => {
    setError(null);
    try {
      const res = await api.cancelWithdrawalRequest(temkaId);
      setSuccessMsg(res.message);
      fetchDashboard();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setError(null);
    try {
      const res = await api.updateTemkaMetadata(editModal.id, {
        title: editTitle,
        description: editDesc,
      });
      setSuccessMsg(res.message);
      closeDashboardModals();
      fetchDashboard();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  const { metrics, myTemkas, activeWithdrawalRequests } = data || {
    metrics: {
      totalTemkas: 0,
      activeCount: 0,
      successfulClosedCount: 0,
      bankruptCount: 0,
      totalCapitalRaised: 0,
      totalPayoutsGiven: 0,
      overallPayoutRate: 0,
    },
    myTemkas: [],
    activeWithdrawalRequests: [],
  };

  // Balance History Filtering
  const filteredHistory = historyItems.filter((item) => {
    // 1. Direction Filter
    if (directionFilter === 'income' && item.direction !== 'income') return false;
    if (directionFilter === 'expense' && item.direction !== 'expense') return false;

    // 2. Category Filter
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

    // 3. Search Query
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchComment = item.comment?.toLowerCase().includes(q);
      const matchSubtext = item.subtext?.toLowerCase().includes(q);
      const matchTemka = item.temkaTitle?.toLowerCase().includes(q);
      const matchRecipient = item.recipientUsername?.toLowerCase().includes(q);
      const matchSender = item.senderUsername?.toLowerCase().includes(q);
      if (!matchTitle && !matchComment && !matchSubtext && !matchTemka && !matchRecipient && !matchSender) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Balance Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div>
          <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block mb-1">
            Рабочая область создателя
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Кабинет автора @{currentUser.username}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Управление своими темками, заявками на вывод и историей баланса
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 sm:p-3 text-left sm:text-right">
            <span className="text-[10px] uppercase font-mono text-neutral-500 block">
              Свободный баланс
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-400 flex items-center gap-1.5 justify-start sm:justify-end">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>{currentUser.balance.toLocaleString()} ₽</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenDepositModal && (
              <button
                onClick={onOpenDepositModal}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer min-h-[44px]"
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Пополнить</span>
              </button>
            )}

            {onOpenTransferModal && (
              <button
                onClick={onOpenTransferModal}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer min-h-[44px]"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                <span>Перевод</span>
              </button>
            )}

            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Новая темка</span>
              <span className="sm:hidden">Создать</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-neutral-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Creator Aggregated Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Привлеченный капитал
          </span>
          <div className="text-base sm:text-lg font-black font-mono text-white truncate">
            {metrics.totalCapitalRaised.toLocaleString()} ₽
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Общий процент выплат
          </span>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
            {metrics.overallPayoutRate}%
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Успешно закрыто
          </span>
          <div className="text-base sm:text-lg font-black font-mono text-neutral-300">
            {metrics.successfulClosedCount}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Банкротств
          </span>
          <div className="text-base sm:text-lg font-black font-mono text-rose-400">
            {metrics.bankruptCount}
          </div>
        </div>
      </div>

      {/* My Temkas & Owner Action Panels (Section 1.2) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider font-mono">
            Мои темки ({myTemkas.length})
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            Активных: <strong className="text-amber-400">{metrics.activeCount}</strong>
          </span>
        </div>

        {myTemkas.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 sm:p-10 text-center">
            <p className="text-sm text-neutral-400 mb-4">У вас пока нет созданных темок.</p>
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2 bg-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Запустить первую темку
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myTemkas.map((temka) => {
              const activeReq = activeWithdrawalRequests.find((w) => w.temkaId === temka.id);
              const isClosedOrBankrupt = temka.status === 'Closed' || temka.status === 'Bankrupt';

              return (
                <div
                  key={temka.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl transition-all"
                >
                  {/* Top info */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            temka.status === 'Active'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : temka.status === 'Bankrupt'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}
                        >
                          {temka.status}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white">{temka.title}</h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 sm:line-clamp-1 mt-0.5">
                        {temka.description}
                      </p>
                    </div>

                    {/* Stats mini grid */}
                    <div className="grid grid-cols-3 sm:flex items-center gap-2 sm:gap-3 font-mono text-xs w-full sm:w-auto">
                      <div className="bg-neutral-950 px-2.5 sm:px-3 py-2 rounded-xl border border-neutral-800 text-center sm:text-left">
                        <span className="text-[10px] text-neutral-500 block uppercase">Капитал</span>
                        <span className="text-emerald-400 font-bold truncate block">
                          {temka.capital.toLocaleString()} ₽
                        </span>
                      </div>
                      <div className="bg-neutral-950 px-2.5 sm:px-3 py-2 rounded-xl border border-neutral-800 text-center sm:text-left">
                        <span className="text-[10px] text-neutral-500 block uppercase">Залог</span>
                        <span className="text-amber-300 font-bold truncate block">
                          {temka.collateral.toLocaleString()} ₽
                        </span>
                      </div>
                      <div className="bg-neutral-950 px-2.5 sm:px-3 py-2 rounded-xl border border-neutral-800 text-center sm:text-left">
                        <span className="text-[10px] text-neutral-500 block uppercase">Сделок</span>
                        <span className="text-white font-bold block">{temka.dealsCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Withdrawal Banner if any */}
                  {activeReq && (
                    <ActiveWithdrawalBannerItem
                      temkaId={temka.id}
                      activeReq={activeReq}
                      onCancel={handleCancelWithdrawal}
                      onTimerExpired={() => {
                        fetchDashboard();
                        fetchHistory();
                      }}
                    />
                  )}

                  {/* OWNER ACTION PANEL (Section 1.2) */}
                  <div className="mt-4 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 flex-wrap">
                      {/* Top Up Capital */}
                      {temka.status === 'Active' && (
                        <button
                          onClick={() => {
                            setTopUpModal({ id: temka.id, title: temka.title });
                            setTopUpAmount(1000);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[36px]"
                        >
                          <Coins className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Пополнить</span>
                        </button>
                      )}

                      {/* Request Withdrawal */}
                      {temka.status === 'Active' && !activeReq && (
                        <button
                          onClick={() => {
                            setWithdrawalModal({
                              id: temka.id,
                              title: temka.title,
                              capital: temka.capital,
                            });
                            setWithdrawAmount(Math.min(temka.capital, 1000));
                            setClaimCollateral(false);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[36px]"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Вывод прибыли</span>
                        </button>
                      )}

                      {/* Edit Metadata */}
                      <button
                        onClick={() => {
                          setEditModal({
                            id: temka.id,
                            title: temka.title,
                            description: temka.description,
                          });
                          setEditTitle(temka.title);
                          setEditDesc(temka.description);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition-colors min-h-[36px]"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Изменить</span>
                      </button>

                      {/* Sandbox Logs */}
                      <button
                        onClick={() => setActiveLogsTemka({ id: temka.id, title: temka.title })}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition-colors min-h-[36px]"
                      >
                        <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Логи</span>
                      </button>

                      {/* Clone Temka */}
                      {onCloneTemka && (
                        <button
                          onClick={() =>
                            onCloneTemka({
                              title: `${temka.title} v2`,
                              description: temka.description,
                              algorithmCode: temka.algorithmCode || '',
                              initialCapital: temka.initialCapital || 5000,
                              collateral: temka.collateral > 0 ? temka.collateral : 3000,
                              minBet: temka.minBet || 100,
                              maxBet: temka.maxBet || 2000,
                            })
                          }
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-amber-300 text-xs font-medium rounded-xl transition-colors min-h-[36px] cursor-pointer"
                          title="Создать новую темку на основе этой"
                        >
                          <Copy className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="truncate">Клонировать</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-1 sm:pt-0">
                      {/* View Public Page */}
                      <button
                        onClick={() => onNavigateTemka(temka.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-amber-300 text-xs font-bold rounded-xl transition-colors min-h-[36px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Страница</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Balance History Section */}
      <div className="space-y-4 pt-2">
        {/* Section Header & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>История баланса ({filteredHistory.length})</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Пополнения, переводы, ставки и выплаты по темкам
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              title="Обновить историю"
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-amber-400' : ''}`} />
              <span>Обновить</span>
            </button>
          </div>
        </div>

        {/* Balance History Card Content */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          {/* Filters Controls */}
          <div className="space-y-3">
          {/* Primary Direction Filter Tabs & Search Bar */}
          <div className="flex flex-col md:flex-row gap-2.5 md:items-center justify-between">
            {/* Direction Tabs: Все / Доходы / Расходы */}
            <div className="flex items-center p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setDirectionFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  directionFilter === 'all'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>Всё</span>
                <span className="text-[10px] opacity-80">({historyItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('income')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  directionFilter === 'income'
                    ? 'bg-emerald-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-emerald-400'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Доходы</span>
                <span className="text-[10px] opacity-80">
                  ({historyItems.filter((i) => i.direction === 'income').length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('expense')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  directionFilter === 'expense'
                    ? 'bg-rose-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-rose-400'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Расходы</span>
                <span className="text-[10px] opacity-80">
                  ({historyItems.filter((i) => i.direction === 'expense').length})
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Поиск по названию, комментарию, нику..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-2 text-neutral-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Category Filter Pills: Всё / Вклады / Темки / Переводы / Пополнения */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-500 mr-1 flex items-center gap-1 font-mono">
              <Filter className="w-3 h-3" />
              Категория:
            </span>

            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-850'
              }`}
            >
              Всё ({historyItems.length})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('investments')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                categoryFilter === 'investments'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-850'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Вклады</span>
              <span className="opacity-70">
                ({historyItems.filter((i) => i.category === 'investments').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('temkas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                categoryFilter === 'temkas'
                  ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/50'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-850'
              }`}
            >
              <Layers className="w-3 h-3 text-purple-400" />
              <span>Темки</span>
              <span className="opacity-70">
                ({historyItems.filter((i) => i.category === 'temkas').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('transfers')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                categoryFilter === 'transfers'
                  ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/50'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-850'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3 text-blue-400" />
              <span>Переводы</span>
              <span className="opacity-70">
                ({historyItems.filter((i) => i.category === 'transfers').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('deposits')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                categoryFilter === 'deposits'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-850'
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Пополнения</span>
              <span className="opacity-70">
                ({historyItems.filter((i) => i.category === 'deposits').length})
              </span>
            </button>
          </div>
        </div>

        {/* History List */}
        {loadingHistory ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-10 text-center">
            <p className="text-xs text-neutral-400 font-mono">
              {historySearch || categoryFilter !== 'all' || directionFilter !== 'all'
                ? 'Нет записей, соответствующих выбранным фильтрам.'
                : 'История баланса пуста. Совершите перевод, сделайте вклад или пополните счёт.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.slice(0, historyVisibleCount).map((item) => {
              const dateFormatted = (() => {
                try {
                  const d = new Date(item.timestamp);
                  return d.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                } catch {
                  return item.timestamp;
                }
              })();

              // RENDER SPECIFIC ITEM TYPE
              if (item.category === 'investments' || item.isInvestment) {
                const delta = item.delta ?? 0;
                const betAmount = item.betAmount ?? 0;
                const payout = item.payout ?? 0;
                const isPositive = delta > 0;
                const isNegative = delta < 0;

                return (
                  <div
                    key={item.id}
                    className="p-3 sm:p-3.5 bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700/80 rounded-xl transition-colors text-xs"
                  >
                    {/* Mobile layout (< sm) */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                              isPositive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : isNegative
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : isNegative ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.temkaId ? (
                                <button
                                  onClick={() => onNavigateTemka(item.temkaId!)}
                                  className="font-bold text-white hover:text-amber-400 transition-colors truncate font-mono text-left cursor-pointer max-w-[160px]"
                                >
                                  {item.title}
                                </button>
                              ) : (
                                <span className="font-bold text-white truncate font-mono">
                                  {item.title}
                                </span>
                              )}

                              {item.isRefund ? (
                                <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">
                                  Возврат
                                </span>
                              ) : item.isDefault ? (
                                <span className="text-[10px] px-1.5 py-0.5 bg-rose-950/80 text-rose-400 border border-rose-800/50 rounded font-mono">
                                  Дефолт
                                </span>
                              ) : item.multiplier ? (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded font-mono font-bold">
                                  x{item.multiplier.toFixed(2)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`font-mono font-black text-sm text-right shrink-0 ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {isPositive ? `+${delta.toLocaleString()} ₽` : `${delta.toLocaleString()} ₽`}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-900/90 flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="flex items-center gap-1 text-neutral-500 shrink-0">
                          <Clock className="w-3 h-3" />
                          {dateFormatted}
                        </span>
                        <div className="text-right text-neutral-400 truncate">
                          Ставка: <span className="text-neutral-300">{betAmount.toLocaleString()} ₽</span> • Выплата: <span className="text-neutral-300">{payout.toLocaleString()} ₽</span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop layout (>= sm) - 100% untouched */}
                    <div className="hidden sm:flex items-center justify-between gap-3">
                      {/* Left: Icon & Title & Meta */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isNegative
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : isNegative ? (
                            <TrendingDown className="w-4 h-4" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.temkaId ? (
                              <button
                                onClick={() => onNavigateTemka(item.temkaId!)}
                                className="font-bold text-white hover:text-amber-400 transition-colors truncate font-mono text-left cursor-pointer max-w-xs md:max-w-md"
                              >
                                {item.title}
                              </button>
                            ) : (
                              <span className="font-bold text-white truncate font-mono">
                                {item.title}
                              </span>
                            )}

                            {/* Multiplier / Status Badge */}
                            {item.isRefund ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">
                                Возврат
                              </span>
                            ) : item.isDefault ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-rose-950/80 text-rose-400 border border-rose-800/50 rounded font-mono">
                                Дефолт
                              </span>
                            ) : item.multiplier ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded font-mono font-bold">
                                x{item.multiplier.toFixed(2)}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {dateFormatted}
                            </span>
                            <span>•</span>
                            <span className="text-neutral-400">Ставка в темку</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Main Delta & Sub Bet/Dividends */}
                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-black text-sm sm:text-base ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {isPositive ? `+${delta.toLocaleString()} ₽` : `${delta.toLocaleString()} ₽`}
                        </div>

                        <div className="text-[10px] sm:text-[11px] text-neutral-400 font-mono mt-0.5">
                          Ставка: <span className="text-neutral-300">{betAmount.toLocaleString()} ₽</span> • Выплата: <span className="text-neutral-300">{payout.toLocaleString()} ₽</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // TRANSFERS (IN / OUT)
              if (item.category === 'transfers') {
                const isOut = item.type === 'transfer_out';
                return (
                  <div
                    key={item.id}
                    className="p-3 sm:p-3.5 bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700/80 rounded-xl transition-colors text-xs"
                  >
                    {/* Mobile layout (< sm) */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                              isOut
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {isOut ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white truncate font-mono">
                              {item.title}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`font-mono font-black text-sm text-right shrink-0 ${
                            isOut ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isOut ? `-${Math.abs(item.amount).toLocaleString()} ₽` : `+${Math.abs(item.amount).toLocaleString()} ₽`}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-900/90 flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="flex items-center gap-1 text-neutral-500 shrink-0">
                          <Clock className="w-3 h-3" />
                          {dateFormatted}
                        </span>
                        <div className="text-right text-neutral-400 truncate">
                          {item.comment ? (
                            <span className="italic text-neutral-300">«{item.comment}»</span>
                          ) : (
                            <span>{isOut ? 'Исходящий перевод' : 'Входящий перевод'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop layout (>= sm) - 100% untouched */}
                    <div className="hidden sm:flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isOut
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isOut ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white truncate font-mono">
                            {item.title}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {dateFormatted}
                            </span>
                            {item.comment && (
                              <>
                                <span>•</span>
                                <span className="text-neutral-400 italic truncate max-w-[200px]">
                                  «{item.comment}»
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-black text-sm sm:text-base ${
                            isOut ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isOut ? `-${Math.abs(item.amount).toLocaleString()} ₽` : `+${Math.abs(item.amount).toLocaleString()} ₽`}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-neutral-500 font-mono mt-0.5">
                          {isOut ? 'Исходящий перевод' : 'Входящий перевод'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // DEPOSITS (ARGON PAY)
              if (item.category === 'deposits') {
                return (
                  <div
                    key={item.id}
                    className="p-3 sm:p-3.5 bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700/80 rounded-xl transition-colors text-xs"
                  >
                    {/* Mobile layout (< sm) */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white truncate font-mono">
                              {item.title}
                            </div>
                          </div>
                        </div>

                        <div className="font-mono font-black text-sm text-right shrink-0 text-emerald-400">
                          +{Math.abs(item.amount).toLocaleString()} ₽
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-900/90 flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="flex items-center gap-1 text-neutral-500 shrink-0">
                          <Clock className="w-3 h-3" />
                          {dateFormatted}
                        </span>
                        <span className="text-amber-400/90 text-right">Argon Pay Эквайринг</span>
                      </div>
                    </div>

                    {/* Desktop layout (>= sm) - 100% untouched */}
                    <div className="hidden sm:flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white truncate font-mono">
                            {item.title}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {dateFormatted}
                            </span>
                            <span>•</span>
                            <span className="text-amber-400/90 font-sans">Argon Pay Эквайринг</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-sm sm:text-base text-emerald-400">
                          +{Math.abs(item.amount).toLocaleString()} ₽
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-neutral-500 font-mono mt-0.5">
                          Пополнение счёта
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // TEMKA OWNER ACTIONS (Create, Topup, Withdraw)
              const isWithdraw = item.type === 'temka_withdraw';
              const isCreate = item.type === 'temka_create';

              return (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700/80 rounded-xl transition-colors text-xs"
                >
                  {/* Mobile layout (< sm) */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                            isWithdraw
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isCreate
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          }`}
                        >
                          {isWithdraw ? (
                            <ArrowDownToLine className="w-4 h-4" />
                          ) : isCreate ? (
                            <PlusCircle className="w-4 h-4" />
                          ) : (
                            <Coins className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {item.temkaId ? (
                            <button
                              onClick={() => onNavigateTemka(item.temkaId!)}
                              className="font-bold text-white hover:text-amber-400 transition-colors truncate font-mono text-left cursor-pointer"
                            >
                              {item.title}
                            </button>
                          ) : (
                            <span className="font-bold text-white truncate font-mono">
                              {item.title}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`font-mono font-black text-sm text-right shrink-0 ${
                          isWithdraw ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isWithdraw ? `+${Math.abs(item.amount).toLocaleString()} ₽` : `-${Math.abs(item.amount).toLocaleString()} ₽`}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-900/90 flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="flex items-center gap-1 text-neutral-500 shrink-0">
                        <Clock className="w-3 h-3" />
                        {dateFormatted}
                      </span>
                      <span className="text-neutral-400 text-right truncate">
                        {item.subtext || (isWithdraw ? 'Вывод из темки' : isCreate ? 'Создание темки' : 'Пополнение темки')}
                      </span>
                    </div>
                  </div>

                  {/* Desktop layout (>= sm) - 100% untouched */}
                  <div className="hidden sm:flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isWithdraw
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isCreate
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        }`}
                      >
                        {isWithdraw ? (
                          <ArrowDownToLine className="w-4 h-4" />
                        ) : isCreate ? (
                          <PlusCircle className="w-4 h-4" />
                        ) : (
                          <Coins className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.temkaId ? (
                            <button
                              onClick={() => onNavigateTemka(item.temkaId!)}
                              className="font-bold text-white hover:text-amber-400 transition-colors truncate font-mono text-left cursor-pointer"
                            >
                              {item.title}
                            </button>
                          ) : (
                            <span className="font-bold text-white truncate font-mono">
                              {item.title}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dateFormatted}
                          </span>
                          {item.subtext && (
                            <>
                              <span>•</span>
                              <span className="text-neutral-400">{item.subtext}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-black text-sm sm:text-base ${
                          isWithdraw ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isWithdraw ? `+${Math.abs(item.amount).toLocaleString()} ₽` : `-${Math.abs(item.amount).toLocaleString()} ₽`}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-neutral-500 font-mono mt-0.5">
                        {isWithdraw
                          ? 'Вывод из темки'
                          : isCreate
                          ? 'Создание темки'
                          : 'Пополнение темки'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show More Button */}
            {filteredHistory.length > historyVisibleCount && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setHistoryVisibleCount((prev) => prev + 25)}
                  className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-mono transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>
                    Показать ещё ({filteredHistory.length - historyVisibleCount} из{' '}
                    {filteredHistory.length})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Top Up Capital Modal */}
      {topUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Пополнить банк темки</h3>
            <p className="text-xs text-neutral-400 mb-4">{topUpModal.title}</p>

            <form onSubmit={handleTopUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Сумма пополнения (₽)
                </label>
                <input
                  type="number"
                  min="100"
                  max={currentUser.balance}
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-white font-mono font-bold"
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  Доступно: {currentUser.balance.toLocaleString()} ₽
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeDashboardModals}
                  className="px-4 py-2 bg-neutral-800 text-neutral-300 text-xs rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl"
                >
                  Пополнить темку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdrawal Request Modal */}
      {withdrawalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Создание заявки на вывод прибыли</h3>
            <p className="text-xs text-neutral-400 mb-4 font-mono">{withdrawalModal.title}</p>

            <form onSubmit={handleCreateWithdrawal} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-300 mb-1">
                  Сумма вывода из капитала (₽)
                </label>
                <input
                  type="number"
                  min="1"
                  max={withdrawalModal.capital}
                  value={withdrawAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setWithdrawAmount(val);
                    if (claimCollateral && val !== withdrawalModal.capital) {
                      setClaimCollateral(false);
                    }
                  }}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-white font-mono font-bold"
                />
                <span className="text-[11px] text-neutral-500 mt-1 block font-mono">
                  Доступно в банке темки: {withdrawalModal.capital.toLocaleString()} ₽
                </span>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                <label className="flex items-center gap-2 text-neutral-200 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={claimCollateral}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setClaimCollateral(checked);
                      if (checked) {
                        setWithdrawAmount(withdrawalModal.capital);
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-0"
                  />
                  <span>Забрать залог и закрыть темку навсегда</span>
                </label>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  При выборе этой опции сумма вывода автоматически заполняется полным остатком капитала ({withdrawalModal.capital.toLocaleString()} ₽), а статус темки изменится на <strong>Closed</strong> после исполнения.
                </p>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-200/90 text-[11px] leading-relaxed">
                <strong>Условие вывода:</strong> Заявка сработает после 10 новых ставок
                или через 48 часов.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeDashboardModals}
                  className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl"
                >
                  Подать заявку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Редактирование метаданных темки</h3>

            <form onSubmit={handleEditMetadata} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Название темки</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Описание темки</label>
                <textarea
                  rows={3}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-2.5 text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeDashboardModals}
                  className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sandbox Execution Logs Modal */}
      {activeLogsTemka && (
        <SandboxLogsModal
          temkaId={activeLogsTemka.id}
          temkaTitle={activeLogsTemka.title}
          isOpen={true}
          onClose={closeDashboardModals}
        />
      )}
    </div>
  );
};
