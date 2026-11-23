import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User, LeaderboardUser, LeaderboardResponse } from '../types';
import {
  Trophy,
  Medal,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  RefreshCw,
  ArrowRightLeft,
  Crown,
} from 'lucide-react';

interface LeaderboardViewProps {
  currentUser: User | null;
  onSelectUser: (userId: string) => void;
  onOpenTransferModal?: (recipientUsername: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
  onSelectUser,
  onOpenTransferModal,
}) => {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeaderboard({
        page,
        pageSize,
        search: debouncedSearch,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки таблицы лидеров');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [page, debouncedSearch]);

  const handleFindMe = () => {
    if (data?.currentUserRank?.page) {
      if (debouncedSearch) {
        setSearchQuery('');
        setDebouncedSearch('');
      }
      setPage(data.currentUserRank.page);
    }
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div
          title="1 место — Золотая медаль"
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 text-neutral-950 shadow-md shadow-amber-500/20 font-black text-sm border border-amber-200 shrink-0"
        >
          <Medal className="w-4 h-4 fill-neutral-950" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div
          title="2 место — Серебряная медаль"
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 via-slate-300 to-gray-400 text-neutral-950 shadow-md shadow-slate-400/20 font-black text-sm border border-slate-100 shrink-0"
        >
          <Medal className="w-4 h-4 fill-neutral-950" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div
          title="3 место — Бронзовая медаль"
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 text-amber-100 shadow-md shadow-amber-900/30 font-black text-sm border border-amber-600/50 shrink-0"
        >
          <Medal className="w-4 h-4 fill-amber-100" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 font-mono font-bold text-xs shrink-0">
        #{rank}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Таблица лидеров
                <span className="text-xs font-normal text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                  по балансу
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-1">
                Рейтинг инвесторов и архитекторов смарт-контрактов платформы Scamulator
              </p>
            </div>
          </div>

          {/* Quick Actions & Stats */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {currentUser && data?.currentUserRank && (
              <button
                id="find-me-leaderboard-btn"
                onClick={handleFindMe}
                title={`Ваше место: #${data.currentUserRank.rank}`}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 min-h-[40px]"
              >
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>
                  Найти себя{' '}
                  <span className="font-mono bg-amber-500/30 px-1.5 py-0.5 rounded text-[11px]">
                    #{data.currentUserRank.rank}
                  </span>
                </span>
              </button>
            )}

            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              title="Обновить таблицу лидеров"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Обновить</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-5 pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="leaderboard-search-input"
              type="text"
              placeholder="Поиск игрока по никнейму или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-all font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-400 font-mono w-full sm:w-auto text-right">
            Всего пользователей: <span className="text-white font-bold">{data?.totalUsers ?? '...'}</span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-xs text-neutral-400 font-mono">Загрузка рейтинга...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-400 mb-3">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold"
            >
              Попробовать снова
            </button>
          </div>
        ) : !data || data.users.length === 0 ? (
          <div className="p-12 text-center">
            <Trophy className="w-10 h-10 text-neutral-600 mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-bold text-white mb-1">Никого не найдено</h3>
            <p className="text-xs text-neutral-400">
              По вашему запросу «{debouncedSearch}» нет подходящих участников.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {/* Header row (desktop) */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-neutral-950/60 text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <div className="col-span-1 text-center">Место</div>
              <div className={currentUser ? 'col-span-5' : 'col-span-7'}>Пользователь</div>
              <div className={`${currentUser ? 'col-span-3' : 'col-span-4'} text-right`}>Баланс</div>
              {currentUser && <div className="col-span-3 text-right">Действия</div>}
            </div>

            {/* User rows */}
            {data.users.map((user) => {
              const isCurrentUser = currentUser && currentUser.id === user.id;

              return (
                <div
                  key={user.id}
                  id={`leaderboard-user-${user.id}`}
                  className={`px-4 sm:px-6 py-4 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center transition-colors ${
                    isCurrentUser
                      ? 'bg-amber-500/[0.07] border-l-4 border-l-amber-500 hover:bg-amber-500/[0.12]'
                      : 'hover:bg-neutral-850/50'
                  }`}
                >
                  {/* Rank Column */}
                  <div className="flex md:col-span-1 items-center justify-between md:justify-center w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      {renderRankBadge(user.rank)}
                      <span className="md:hidden text-xs text-neutral-400 font-mono">
                        Место #{user.rank}
                      </span>
                    </div>

                    {/* Mobile Balance Display */}
                    <div className="md:hidden text-right">
                      <span className="text-sm font-mono font-black text-emerald-400">
                        {user.balance.toLocaleString()} ₽
                      </span>
                    </div>
                  </div>

                  {/* User Profile Info Column */}
                  <div className={`${currentUser ? 'md:col-span-5' : 'md:col-span-7'} flex items-center gap-3 w-full`}>
                    <button
                      onClick={() => onSelectUser(user.id)}
                      className="shrink-0 relative group cursor-pointer"
                      title={`Открыть профиль @${user.username}`}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-neutral-700 group-hover:ring-amber-500/60 transition-all"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 text-amber-400 flex items-center justify-center font-bold text-sm ring-1 ring-neutral-700 group-hover:ring-amber-500/60 transition-all">
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {user.rank <= 3 && (
                        <div className="absolute -top-1 -right-1">
                          <Crown className={`w-3.5 h-3.5 ${
                            user.rank === 1 ? 'text-amber-400 fill-amber-400' :
                            user.rank === 2 ? 'text-slate-300 fill-slate-300' :
                            'text-amber-700 fill-amber-700'
                          }`} />
                        </div>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onSelectUser(user.id)}
                          className="text-sm font-bold text-white hover:text-amber-400 transition-colors truncate font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <span>@{user.username}</span>
                        </button>

                        {isCurrentUser && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                            ВЫ
                          </span>
                        )}
                      </div>

                      {user.bio ? (
                        <p className="text-xs text-neutral-400 truncate mt-0.5 max-w-md">
                          {user.bio}
                        </p>
                      ) : (
                        <p className="text-[11px] text-neutral-600 italic mt-0.5">
                          Нет описания
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Desktop Balance Column */}
                  <div className={`hidden md:block ${currentUser ? 'md:col-span-3' : 'md:col-span-4'} text-right`}>
                    <div className="text-sm sm:text-base font-mono font-black text-emerald-400">
                      {user.balance.toLocaleString()} ₽
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {user.temkasCount !== undefined && user.temkasCount > 0
                        ? `Темки: ${user.temkasCount}`
                        : 'Инвестор'}
                    </div>
                  </div>

                  {/* Actions Column (Only shown when user is authorized) */}
                  {currentUser && (
                    <div className="md:col-span-3 flex items-center justify-end gap-2 w-full pt-1 md:pt-0">
                      {currentUser.id !== user.id && onOpenTransferModal && (
                        <button
                          onClick={() => onOpenTransferModal(user.username)}
                          title={`Перевести деньги @${user.username}`}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ml-auto"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Перевод</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.totalPages > 1 && (
          <div className="px-6 py-4 bg-neutral-950/80 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-400 font-mono">
              Страница <span className="text-white font-bold">{data.page}</span> из{' '}
              <span className="text-white font-bold">{data.totalPages}</span> (показано{' '}
              {data.users.length} из {data.totalUsers})
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1 || loading}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[36px]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>

              {/* Page Number Pills */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  // Calculate dynamic window around current page
                  let pageNum: number;
                  if (data.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (data.page <= 3) {
                    pageNum = i + 1;
                  } else if (data.page >= data.totalPages - 2) {
                    pageNum = data.totalPages - 4 + i;
                  } else {
                    pageNum = data.page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        data.page === pageNum
                          ? 'bg-amber-500 text-neutral-950 shadow-md font-black'
                          : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-750'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages || loading}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[36px]"
              >
                <span>Вперед</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
