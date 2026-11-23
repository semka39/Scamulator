import React from 'react';
import { User } from '../types';
import {
  Coins,
  PlusCircle,
  LayoutDashboard,
  Compass,
  Trophy,
  User as UserIcon,
  LogIn,
  LogOut,
  Flame,
  ArrowRightLeft,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  activeView: 'catalog' | 'dashboard' | 'profile' | 'temka' | 'leaderboard';
  onNavigate: (view: 'catalog' | 'dashboard' | 'profile' | 'leaderboard', targetId?: string) => void;
  onOpenCreateModal: () => void;
  onOpenAuthModal: () => void;
  onOpenDepositModal?: () => void;
  onOpenTransferModal?: () => void;
  onLogout: () => void;
  currentProfileUserId?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onOpenCreateModal,
  onOpenAuthModal,
  onOpenDepositModal,
  onOpenTransferModal,
  onLogout,
  currentProfileUserId,
}) => {
  const isOwnProfileActive =
    activeView === 'profile' &&
    currentUser &&
    (!currentProfileUserId || currentProfileUserId === currentUser.id);

  return (
    <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Main Navigation */}
          <div className="flex items-center gap-6">
            <button
              id="header-brand-logo"
              onClick={() => onNavigate('catalog')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-white font-mono flex items-center">
                  SCAM<span className="text-amber-400">ULATOR</span>
                </span>
                <span className="block text-[10px] text-neutral-400 font-mono tracking-wider uppercase -mt-0.5">
                  Смарт-контракты
                </span>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5">
              <button
                id="nav-catalog-btn"
                onClick={() => onNavigate('catalog')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'catalog'
                    ? 'bg-neutral-800 text-amber-400 shadow-xs border border-neutral-700'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Compass className="w-4 h-4" />
                Каталог темок
              </button>

              <button
                id="nav-leaderboard-btn"
                onClick={() => onNavigate('leaderboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'leaderboard'
                    ? 'bg-neutral-800 text-amber-400 shadow-xs border border-neutral-700'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Trophy className="w-4 h-4" />
                Таблица лидеров
              </button>

              {currentUser && (
                <button
                  id="nav-dashboard-btn"
                  onClick={() => onNavigate('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeView === 'dashboard'
                      ? 'bg-neutral-800 text-amber-400 shadow-xs border border-neutral-700'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Личный кабинет
                </button>
              )}
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Balance badge */}
                <button
                  onClick={() => onNavigate('dashboard')}
                  title="Перейти в личный кабинет"
                  className="flex items-center bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl px-3 py-1.5 shadow-inner gap-1.5 transition-colors cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                    {currentUser.balance.toLocaleString()} ₽
                  </span>
                </button>

                {/* Create Temka Button (desktop only, available in mobile nav below) */}
                <button
                  id="create-temka-header-btn"
                  onClick={onOpenCreateModal}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Создать темку</span>
                </button>

                {/* User avatar & logout (Avatar is highlighted when in own profile) */}
                <div className="flex items-center gap-1.5 sm:gap-2 pl-1 border-l border-neutral-800 shrink-0">
                  <button
                    id="header-user-avatar-btn"
                    onClick={() => onNavigate('profile', currentUser.id)}
                    title={`Мой профиль (@${currentUser.username})`}
                    className={`flex items-center gap-2 px-2 py-1 rounded-xl transition-all cursor-pointer min-h-[36px] min-w-[36px] ${
                      isOwnProfileActive
                        ? 'bg-neutral-800 border border-amber-500/60 ring-2 ring-amber-500/20 text-amber-400 shadow-md'
                        : 'hover:bg-neutral-900 border border-transparent'
                    }`}
                  >
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.username}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ${
                          isOwnProfileActive ? 'ring-amber-400' : 'ring-neutral-700'
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold ring-1 ${
                          isOwnProfileActive
                            ? 'bg-amber-500/20 text-amber-300 ring-amber-400'
                            : 'bg-neutral-800 text-amber-400 ring-neutral-700'
                        }`}
                      >
                        {currentUser.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`text-xs font-bold hidden lg:inline font-mono ${
                        isOwnProfileActive ? 'text-amber-400' : 'text-neutral-200'
                      }`}
                    >
                      @{currentUser.username}
                    </span>
                  </button>

                  <button
                    onClick={onLogout}
                    title="Выйти из аккаунта"
                    className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 rounded-xl transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="header-login-btn"
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer active:scale-95 min-h-[40px]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Войти</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div
          className={`md:hidden grid gap-1 py-1.5 border-t border-neutral-800/80 text-xs ${
            currentUser ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <button
            onClick={() => onNavigate('catalog')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl font-bold min-h-[44px] transition-colors ${
              activeView === 'catalog'
                ? 'text-amber-400 bg-neutral-900/90 border border-neutral-800'
                : 'text-neutral-400 hover:text-neutral-200 active:bg-neutral-900/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="text-[10px] sm:text-xs">Каталог</span>
          </button>

          <button
            onClick={() => onNavigate('leaderboard')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl font-bold min-h-[44px] transition-colors ${
              activeView === 'leaderboard'
                ? 'text-amber-400 bg-neutral-900/90 border border-neutral-800'
                : 'text-neutral-400 hover:text-neutral-200 active:bg-neutral-900/50'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span className="text-[10px] sm:text-xs">Лидеры</span>
          </button>

          {currentUser && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl font-bold min-h-[44px] transition-colors ${
                activeView === 'dashboard'
                  ? 'text-amber-400 bg-neutral-900/90 border border-neutral-800'
                  : 'text-neutral-400 hover:text-neutral-200 active:bg-neutral-900/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-[10px] sm:text-xs">Кабинет</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

