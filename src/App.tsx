import React, { useState, useEffect } from 'react';
import { api } from './api';
import { User, Temka } from './types';
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

type AppTab = 'catalog' | 'dashboard' | 'temka' | 'profile' | 'leaderboard';

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
    // If gate_pass is present in URL, store it and clean the URL
    try {
      const url = new URL(window.location.href);
      const gatePass = url.searchParams.get('gate_pass');
      if (gatePass) {
        localStorage.setItem('scam_gate_pass', gatePass);
        document.cookie = `scam_gate_pass=${encodeURIComponent(gatePass)}; path=/; max-age=86400; SameSite=None; Secure`;
        document.cookie = `scam_gate_pass=${encodeURIComponent(gatePass)}; path=/; max-age=86400; SameSite=Lax`;
        url.searchParams.delete('gate_pass');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
      }
    } catch (e) {}

    refreshUser();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      if (activeTab === 'dashboard') {
        setActiveTab('catalog');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navigateToTemka = (temkaId: string) => {
    setSelectedTemkaId(temkaId);
    setActiveTab('temka');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToAuthor = (authorId: string) => {
    setSelectedAuthorId(authorId);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateSuccess = (temka: Temka) => {
    refreshUser();
    navigateToTemka(temka.id);
  };

  const handleOpenTransfer = (recipientUsername?: string) => {
    if (!currentUser) {
      setAuthMode('login');
      setIsAuthOpen(true);
      return;
    }
    setTransferRecipient(recipientUsername || '');
    setIsTransferOpen(true);
  };

  const handleOpenDeposit = () => {
    if (!currentUser) {
      setAuthMode('login');
      setIsAuthOpen(true);
      return;
    }
    setIsDepositOpen(true);
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
        onNavigate={(view, targetId) => {
          if (view === 'catalog') {
            setSelectedTemkaId(null);
            setSelectedAuthorId(null);
            setActiveTab('catalog');
          } else if (view === 'leaderboard') {
            setSelectedTemkaId(null);
            setSelectedAuthorId(null);
            setActiveTab('leaderboard');
          } else if (view === 'dashboard') {
            if (!currentUser) {
              setAuthMode('login');
              setIsAuthOpen(true);
              return;
            }
            setActiveTab('dashboard');
          } else if (view === 'profile') {
            const target = targetId || (currentUser ? currentUser.id : null);
            if (target) {
              setSelectedAuthorId(target);
              setActiveTab('profile');
            } else {
              setAuthMode('login');
              setIsAuthOpen(true);
            }
          }
        }}
        onOpenCreateModal={() => {
          if (!currentUser) {
            setAuthMode('login');
            setIsAuthOpen(true);
          } else {
            setIsCreateOpen(true);
          }
        }}
        onOpenAuthModal={() => {
          setAuthMode('login');
          setIsAuthOpen(true);
        }}
        onOpenDepositModal={handleOpenDeposit}
        onOpenTransferModal={() => handleOpenTransfer()}
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
            onOpenCreateModal={() => setIsCreateOpen(true)}
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
            onBack={() => setActiveTab('catalog')}
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
            onBack={() => setActiveTab('catalog')}
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
              Симулятор высокорисковых схем и алгоритмических пулов
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
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Create Temka Modal */}
      <CreateTemkaModal
        isOpen={isCreateOpen}
        currentUser={currentUser}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Deposit Modal (Argon Pay) */}
      {currentUser && (
        <DepositModal
          isOpen={isDepositOpen}
          currentUser={currentUser}
          onClose={() => setIsDepositOpen(false)}
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
          onClose={() => {
            setIsTransferOpen(false);
            setTransferRecipient('');
          }}
          onSuccess={(newBalance) => {
            setCurrentUser({ ...currentUser, balance: newBalance });
          }}
        />
      )}
    </div>
  );
}
