import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { User, Temka, TemkaClonePayload } from './types';
import { InAppBrowserBanner } from './components/InAppBrowserBanner';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { CatalogView } from './components/CatalogView';
import { PublicTemkaView } from './components/PublicTemkaView';
import { PrivateDashboard } from './components/PrivateDashboard';
import { PublicProfileView } from './components/PublicProfileView';
import { CreateTemkaModal } from './components/CreateTemkaModal';
import { DepositModal } from './components/DepositModal';
import { TransferModal } from './components/TransferModal';
import { LeaderboardView } from './components/LeaderboardView';
import { NotificationsModal } from './components/NotificationsModal';

type AppTab = 'catalog' | 'dashboard' | 'temka' | 'profile' | 'leaderboard';

interface AppHistoryState {
  __scamulator: true;
  tab: AppTab;
  temkaId: string | null;
  authorId: string | null;
  modal: 'auth' | 'create' | 'deposit' | 'transfer' | 'notifications' | null;
  authMode?: 'login' | 'register';
  transferRecipient?: string;
  depth: number;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('catalog');
  const [selectedTemkaId, setSelectedTemkaId] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<string>('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [cloneData, setCloneData] = useState<TemkaClonePayload | null>(null);
  const isClosingModalRef = useRef(false);

  // Initial session fetch
  const refreshUser = async () => {
    try {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setUnreadNotifications(0);
      return;
    }
    const fetchUnread = async () => {
      if (document.hidden) return;
      try {
        const res = await api.getNotifications();
        setUnreadNotifications(res.unreadCount);
      } catch {}
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 15000);
    return () => clearInterval(timer);
  }, [currentUser?.id]);

  // Synchronize React state from a history state entry
  const applyHistoryState = (state: AppHistoryState | null) => {
    isClosingModalRef.current = false;
    if (!state || !state.__scamulator) {
      setActiveTab('catalog');
      setSelectedTemkaId(null);
      setSelectedAuthorId(null);
      setIsAuthOpen(false);
      setIsCreateOpen(false);
      setIsDepositOpen(false);
      setIsTransferOpen(false);
      setIsNotificationsOpen(false);
      setTransferRecipient('');
      return;
    }

    setActiveTab(state.tab || 'catalog');
    setSelectedTemkaId(state.temkaId || null);
    setSelectedAuthorId(state.authorId || null);

    setIsAuthOpen(state.modal === 'auth');
    if (state.authMode) setAuthMode(state.authMode);

    setIsCreateOpen(state.modal === 'create');
    setIsDepositOpen(state.modal === 'deposit');
    setIsNotificationsOpen(state.modal === 'notifications');

    setIsTransferOpen(state.modal === 'transfer');
    if (state.transferRecipient !== undefined) {
      setTransferRecipient(state.transferRecipient);
    }
  };

  useEffect(() => {
    // If gate_pass is present in URL, store it and clean the URL
    try {
      const url = new URL(window.location.href);
      const gatePass = url.searchParams.get('gate_pass');
      if (gatePass) {
        localStorage.setItem('scam_gate_pass', gatePass);
        document.cookie = `scam_gate_pass=${encodeURIComponent(gatePass)}; path=/; max-age=86400; SameSite=None; Secure`;
        document.cookie = `scam_gate_pass=${encodeURIComponent(gatePass)}; path=/; max-age=86400; SameSite=Lax`;
        url.searchParams.delete('gate_pass');
      }
    } catch (e) {}

    // Initialize or restore history state
    const existing = window.history.state as AppHistoryState | null;
    if (existing && existing.__scamulator) {
      applyHistoryState(existing);
    } else {
      const initial: AppHistoryState = {
        __scamulator: true,
        tab: 'catalog',
        temkaId: null,
        authorId: null,
        modal: null,
        depth: 0,
      };
      window.history.replaceState(initial, '');
    }

    // Listen to popstate (Browser Back / Forward buttons)
    const handlePopState = (e: PopStateEvent) => {
      applyHistoryState(e.state as AppHistoryState | null);
    };

    window.addEventListener('popstate', handlePopState);
    refreshUser();

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const openModal = (
    modal: 'auth' | 'create' | 'deposit' | 'transfer' | 'notifications',
    opts?: { authMode?: 'login' | 'register'; transferRecipient?: string }
  ) => {
    if (modal === 'auth') {
      setAuthMode(opts?.authMode || 'login');
      setIsAuthOpen(true);
    } else if (modal === 'create') {
      setIsCreateOpen(true);
    } else if (modal === 'deposit') {
      setIsDepositOpen(true);
    } else if (modal === 'transfer') {
      setTransferRecipient(opts?.transferRecipient || '');
      setIsTransferOpen(true);
    } else if (modal === 'notifications') {
      setIsNotificationsOpen(true);
    }

    const currentState = window.history.state as AppHistoryState | null;
    const depth = (currentState?.depth ?? 0) + 1;
    const nextState: AppHistoryState = {
      __scamulator: true,
      tab: currentState?.tab || activeTab,
      temkaId: currentState?.temkaId ?? selectedTemkaId,
      authorId: currentState?.authorId ?? selectedAuthorId,
      modal,
      authMode: opts?.authMode,
      transferRecipient: opts?.transferRecipient,
      depth,
    };
    window.history.pushState(nextState, '');
  };

  const closeModal = () => {
    setIsAuthOpen(false);
    setIsCreateOpen(false);
    setIsDepositOpen(false);
    setIsTransferOpen(false);
    setIsNotificationsOpen(false);
    setTransferRecipient('');
    setCloneData(null);

    if (isClosingModalRef.current) return;

    const currentState = window.history.state as (AppHistoryState & { depositStep?: string }) | null;
    if (currentState && currentState.modal) {
      isClosingModalRef.current = true;
      if (currentState.depositStep === 'invoice') {
        window.history.go(-2);
      } else {
        window.history.back();
      }
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      if (activeTab === 'dashboard') {
        handleHeaderNavigate('catalog');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navigateToTemka = (temkaId: string, replace = false) => {
    setSelectedTemkaId(temkaId);
    setSelectedAuthorId(null);
    setActiveTab('temka');
    setIsAuthOpen(false);
    setIsCreateOpen(false);
    setIsDepositOpen(false);
    setIsTransferOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const currentState = window.history.state as AppHistoryState | null;
    const depth = replace ? (currentState?.depth ?? 0) : (currentState?.depth ?? 0) + 1;
    const nextState: AppHistoryState = {
      __scamulator: true,
      tab: 'temka',
      temkaId,
      authorId: null,
      modal: null,
      depth,
    };

    if (replace) {
      window.history.replaceState(nextState, '');
    } else {
      window.history.pushState(nextState, '');
    }
  };

  const navigateToAuthor = (authorId: string, replace = false) => {
    setSelectedAuthorId(authorId);
    setSelectedTemkaId(null);
    setActiveTab('profile');
    setIsAuthOpen(false);
    setIsCreateOpen(false);
    setIsDepositOpen(false);
    setIsTransferOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const currentState = window.history.state as AppHistoryState | null;
    const depth = replace ? (currentState?.depth ?? 0) : (currentState?.depth ?? 0) + 1;
    const nextState: AppHistoryState = {
      __scamulator: true,
      tab: 'profile',
      temkaId: null,
      authorId,
      modal: null,
      depth,
    };

    if (replace) {
      window.history.replaceState(nextState, '');
    } else {
      window.history.pushState(nextState, '');
    }
  };

  const handleHeaderNavigate = (view: AppTab, targetId?: string | null) => {
    if (view === 'catalog') {
      if (activeTab === 'catalog' && !selectedTemkaId && !selectedAuthorId && !window.history.state?.modal) {
        return;
      }
      setSelectedTemkaId(null);
      setSelectedAuthorId(null);
      setActiveTab('catalog');
      setIsAuthOpen(false);
      setIsCreateOpen(false);
      setIsDepositOpen(false);
      setIsTransferOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const currentState = window.history.state as AppHistoryState | null;
      const depth = (currentState?.depth ?? 0) + 1;
      window.history.pushState(
        {
          __scamulator: true,
          tab: 'catalog',
          temkaId: null,
          authorId: null,
          modal: null,
          depth,
        },
        ''
      );
    } else if (view === 'leaderboard') {
      if (activeTab === 'leaderboard' && !window.history.state?.modal) {
        return;
      }
      setSelectedTemkaId(null);
      setSelectedAuthorId(null);
      setActiveTab('leaderboard');
      setIsAuthOpen(false);
      setIsCreateOpen(false);
      setIsDepositOpen(false);
      setIsTransferOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const currentState = window.history.state as AppHistoryState | null;
      const depth = (currentState?.depth ?? 0) + 1;
      window.history.pushState(
        {
          __scamulator: true,
          tab: 'leaderboard',
          temkaId: null,
          authorId: null,
          modal: null,
          depth,
        },
        ''
      );
    } else if (view === 'dashboard') {
      if (!currentUser) {
        openModal('auth', { authMode: 'login' });
        return;
      }
      if (activeTab === 'dashboard' && !window.history.state?.modal) {
        return;
      }
      setSelectedTemkaId(null);
      setSelectedAuthorId(null);
      setActiveTab('dashboard');
      setIsAuthOpen(false);
      setIsCreateOpen(false);
      setIsDepositOpen(false);
      setIsTransferOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const currentState = window.history.state as AppHistoryState | null;
      const depth = (currentState?.depth ?? 0) + 1;
      window.history.pushState(
        {
          __scamulator: true,
          tab: 'dashboard',
          temkaId: null,
          authorId: null,
          modal: null,
          depth,
        },
        ''
      );
    } else if (view === 'profile') {
      const target = targetId || (currentUser ? currentUser.id : null);
      if (target) {
        navigateToAuthor(target);
      } else {
        openModal('auth', { authMode: 'login' });
      }
    }
  };

  const handleOnScreenBack = () => {
    const currentState = window.history.state as AppHistoryState | null;
    if (currentState && (currentState.depth ?? 0) > 0) {
      window.history.back();
    } else {
      handleHeaderNavigate('catalog');
    }
  };

  const handleCreateSuccess = (temka: Temka) => {
    refreshUser();
    setIsCreateOpen(false);
    setCloneData(null);
    navigateToTemka(temka.id, true);
  };

  const handleCloneTemka = (data: TemkaClonePayload) => {
    setCloneData(data);
    openModal('create');
  };

  const handleOpenTransfer = (recipientUsername?: string) => {
    if (!currentUser) {
      openModal('auth', { authMode: 'login' });
      return;
    }
    openModal('transfer', { transferRecipient: recipientUsername || '' });
  };

  const handleOpenDeposit = () => {
    if (!currentUser) {
      openModal('auth', { authMode: 'login' });
      return;
    }
    openModal('deposit');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500 selection:text-neutral-950">
      {/* In-App Browser Warning Banner */}
      <InAppBrowserBanner />

      {/* Main Navigation Header */}
      <Header
        currentUser={currentUser}
        activeView={activeTab}
        currentProfileUserId={activeTab === 'profile' ? selectedAuthorId : null}
        onNavigate={handleHeaderNavigate}
        onOpenCreateModal={() => {
          if (!currentUser) {
            openModal('auth', { authMode: 'login' });
          } else {
            setCloneData(null);
            openModal('create');
          }
        }}
        onOpenAuthModal={() => openModal('auth', { authMode: 'login' })}
        onOpenDepositModal={handleOpenDeposit}
        onOpenTransferModal={() => handleOpenTransfer()}
        onOpenNotificationsModal={() => openModal('notifications')}
        unreadNotificationsCount={unreadNotifications}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'catalog' && (
          <CatalogView
            onSelectTemka={navigateToTemka}
            onSelectAuthor={navigateToAuthor}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            currentUser={currentUser}
            onSelectUser={navigateToAuthor}
            onOpenTransferModal={(recipient) => handleOpenTransfer(recipient)}
          />
        )}

        {activeTab === 'dashboard' && currentUser && (
          <PrivateDashboard
            currentUser={currentUser}
            onNavigateTemka={navigateToTemka}
            onOpenCreateModal={() => {
              setCloneData(null);
              openModal('create');
            }}
            onCloneTemka={handleCloneTemka}
            onOpenDepositModal={handleOpenDeposit}
            onOpenTransferModal={() => handleOpenTransfer()}
            onUserBalanceUpdated={(newBal) =>
              setCurrentUser({ ...currentUser, balance: newBal })
            }
          />
        )}

        {activeTab === 'temka' && selectedTemkaId && (
          <PublicTemkaView
            temkaId={selectedTemkaId}
            currentUser={currentUser}
            onBack={handleOnScreenBack}
            onViewAuthor={navigateToAuthor}
            onUserBalanceUpdated={(newBal) => {
              if (currentUser) {
                setCurrentUser({ ...currentUser, balance: newBal });
              }
            }}
          />
        )}

        {activeTab === 'profile' && selectedAuthorId && (
          <PublicProfileView
            userId={selectedAuthorId}
            currentUser={currentUser}
            onBack={handleOnScreenBack}
            onNavigateTemka={navigateToTemka}
            onOpenTransferModal={(recipient) => handleOpenTransfer(recipient)}
            onProfileUpdated={(updatedUser) => {
              setCurrentUser(updatedUser);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-850 bg-neutral-950 py-6 text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-mono font-bold text-white tracking-wider">
              SCAM<span className="text-amber-400">ULATOR</span>
            </span>
            <span className="hidden sm:inline text-neutral-600">•</span>
            <span className="text-neutral-400">
              Игра-симулятор высокорисковых темок
            </span>
          </div>

          <div className="flex items-center justify-center text-[11px] font-mono text-neutral-500">
            <span>© 2026 Scamulator</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={closeModal}
        onSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Create Temka Modal */}
      <CreateTemkaModal
        isOpen={isCreateOpen}
        currentUser={currentUser}
        cloneData={cloneData}
        onClose={closeModal}
        onSuccess={handleCreateSuccess}
      />

      {/* Notifications Modal */}
      {currentUser && (
        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={closeModal}
          onNavigateTemka={(temkaId) => {
            setIsNotificationsOpen(false);
            navigateToTemka(temkaId, true);
          }}
          onNavigateProfile={(userId) => {
            setIsNotificationsOpen(false);
            navigateToAuthor(userId, true);
          }}
          onUnreadCountChanged={(count) => setUnreadNotifications(count)}
        />
      )}

      {/* Deposit Modal (Argon Pay) */}
      {currentUser && (
        <DepositModal
          isOpen={isDepositOpen}
          currentUser={currentUser}
          onClose={closeModal}
          onSuccess={(newBalance) => {
            setCurrentUser({ ...currentUser, balance: newBalance });
          }}
        />
      )}

      {/* Transfer Modal */}
      {currentUser && (
        <TransferModal
          isOpen={isTransferOpen}
          currentUser={currentUser}
          initialRecipient={transferRecipient}
          onClose={closeModal}
          onSuccess={(newBalance) => {
            setCurrentUser({ ...currentUser, balance: newBalance });
          }}
        />
      )}
    </div>
  );
}
