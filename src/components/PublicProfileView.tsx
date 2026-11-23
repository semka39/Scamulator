import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { User, CreatorMetrics, Temka } from '../types';
import { TemkaCard } from './TemkaCard';
import {
  User as UserIcon,
  Coins,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Layers,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Edit3,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Camera,
  ArrowRightLeft,
  Medal,
  Trophy,
  Crown,
} from 'lucide-react';

interface PublicProfileViewProps {
  userId: string;
  currentUser?: User | null;
  onBack: () => void;
  onNavigateTemka: (temkaId: string) => void;
  onProfileUpdated?: (updatedUser: User) => void;
  onOpenTransferModal?: (recipientUsername: string) => void;
}

const AVATAR_PRESETS = [
  { label: 'Волк с Уолл-стрит', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80' },
  { label: 'Квант', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80' },
  { label: 'Дейтрейдер', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80' },
  { label: 'Хакер', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&auto=format&fit=crop&q=80' },
  { label: 'Крипто-робот 1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=crypto_whale' },
  { label: 'Крипто-робот 2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=smart_contract' },
  { label: 'Киберпанк', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber_trader' },
];

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  userId,
  currentUser,
  onBack,
  onNavigateTemka,
  onProfileUpdated,
  onOpenTransferModal,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [metrics, setMetrics] = useState<CreatorMetrics | null>(null);
  const [temkas, setTemkas] = useState<Temka[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Bankrupt' | 'Closed'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser && user && (currentUser.id === user.id || currentUser.username === user.username);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPublicProfile(userId);
      setUser(res.user);
      setMetrics(res.metrics);
      setTemkas(res.temkas);
      setEditBio(res.user.bio || '');
      setEditAvatarUrl(res.user.avatarUrl || '');
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Размер изображения не должен превышать 2 МБ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setEditAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const res = await api.updateProfile({
        bio: editBio,
        avatarUrl: editAvatarUrl,
      });

      setUser(res.user);
      setSaveSuccess('Профиль успешно сохранен!');
      setIsEditing(false);
      if (onProfileUpdated) {
        onProfileUpdated(res.user);
      }
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить профиль');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user || !metrics) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Профиль не найден</h3>
        <p className="text-xs text-neutral-400 mb-6">{error || 'Пользователь не существует'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  const filteredTemkas = temkas.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Bar with Profile Info */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться в каталог</span>
          </button>

          <div className="flex items-center gap-2">
            {!isOwnProfile && currentUser && onOpenTransferModal && (
              <button
                onClick={() => onOpenTransferModal(user.username)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Перевести @{user.username}</span>
              </button>
            )}

            {isOwnProfile && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-300 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Редактировать профиль</span>
              </button>
            )}
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/40 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-neutral-800 border-2 border-amber-500/40 flex items-center justify-center text-xl font-bold text-amber-400">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    @{user.username}
                  </h1>
                  {user.rank && user.rank <= 3 && (
                    <span className="sm:hidden flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-neutral-800 border border-neutral-700">
                      {user.rank === 1 ? '🥇 #1 Платформы' : user.rank === 2 ? '🥈 #2 Платформы' : '🥉 #3 Платформы'}
                    </span>
                  )}
                </div>

                {user.bio ? (
                  <p className="text-xs text-neutral-300 mt-1 max-w-xl leading-relaxed">{user.bio}</p>
                ) : (
                  <p className="text-xs text-neutral-500 mt-1 italic">Описание профиля пока не заполнено</p>
                )}

                <div className="flex items-center gap-4 text-xs text-neutral-400 mt-2 font-mono flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                    Регистрация: {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Coins className="w-3.5 h-3.5" />
                    Баланс: {user.balance.toLocaleString()} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* Top-3 Leaderboard Medal Badge (Right side of profile header) */}
            {user.rank && user.rank <= 3 && (
              <div className="hidden sm:flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border shrink-0 min-w-[140px] text-center shadow-lg transition-all animate-in zoom-in-95 duration-150 relative overflow-hidden group bg-gradient-to-b from-neutral-900 to-neutral-950"
                style={{
                  borderColor:
                    user.rank === 1
                      ? 'rgba(245, 158, 11, 0.4)'
                      : user.rank === 2
                      ? 'rgba(203, 213, 225, 0.35)'
                      : 'rgba(180, 83, 9, 0.35)',
                }}
              >
                {/* Glow backdrop */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none rounded-2xl"
                  style={{
                    backgroundColor:
                      user.rank === 1 ? '#f59e0b' : user.rank === 2 ? '#e2e8f0' : '#b45309',
                  }}
                />

                {user.rank === 1 && (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 flex items-center justify-center text-neutral-950 shadow-md shadow-amber-500/30 border border-amber-200 mb-1.5 ring-2 ring-amber-400/40">
                      <Medal className="w-6 h-6 fill-neutral-950" />
                    </div>
                    <span className="text-xs font-black font-mono uppercase tracking-wider text-amber-300">
                      Золотая медаль
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono">1 место в рейтинге</span>
                  </>
                )}

                {user.rank === 2 && (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 via-slate-200 to-gray-300 flex items-center justify-center text-neutral-950 shadow-md shadow-slate-300/30 border border-white mb-1.5 ring-2 ring-slate-300/40">
                      <Medal className="w-6 h-6 fill-neutral-950" />
                    </div>
                    <span className="text-xs font-black font-mono uppercase tracking-wider text-slate-200">
                      Серебряная медаль
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">2 место в рейтинге</span>
                  </>
                )}

                {user.rank === 3 && (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 flex items-center justify-center text-amber-100 shadow-md shadow-amber-900/40 border border-amber-600/50 mb-1.5 ring-2 ring-amber-700/40">
                      <Medal className="w-6 h-6 fill-amber-100" />
                    </div>
                    <span className="text-xs font-black font-mono uppercase tracking-wider text-amber-500">
                      Бронзовая медаль
                    </span>
                    <span className="text-[10px] text-amber-600 font-mono">3 место в рейтинге</span>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Profile Edit Mode */
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Настройка профиля и аватарки</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditBio(user.bio || '');
                  setEditAvatarUrl(user.avatarUrl || '');
                }}
                className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                <span>Отмена</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Avatar Upload & Selection */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Аватарка пользователя
                </label>

                <div className="flex items-center gap-3">
                  {editAvatarUrl ? (
                    <img
                      src={editAvatarUrl}
                      alt="Предпросмотр"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-lg shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-neutral-800 border-2 border-dashed border-neutral-700 flex items-center justify-center text-neutral-500 shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs text-neutral-200 rounded-xl transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Загрузить фото</span>
                    </button>
                    <span className="text-[10px] text-neutral-500 block text-center">
                      PNG, JPG, WebP до 2 МБ
                    </span>
                  </div>
                </div>

                {/* Preset Avatars */}
                <div>
                  <span className="text-[11px] text-neutral-400 block mb-1.5">
                    Или выберите готовую аватарку:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditAvatarUrl(preset.url)}
                        className={`p-1 rounded-xl border transition-all ${
                          editAvatarUrl === preset.url
                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950'
                        }`}
                        title={preset.label}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-8 h-8 rounded-lg object-cover mx-auto"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct URL Input */}
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">
                    Или вставьте ссылку на изображение:
                  </label>
                  <input
                    type="url"
                    value={editAvatarUrl.startsWith('data:') ? '' : editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Bio & Description Editing */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300">
                    Описание профиля (Био)
                  </label>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {editBio.length}/500
                  </span>
                </div>

                <textarea
                  rows={5}
                  maxLength={500}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Расскажите о себе, вашей торговой стратегии или алгоритмах смарт-контрактов..."
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 leading-relaxed resize-none font-sans"
                />

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditBio(user.bio || '');
                      setEditAvatarUrl(user.avatarUrl || '');
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 rounded-xl transition-all cursor-pointer"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Сохранить профиль</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Aggregated Creator Metrics (Section 1.1) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Привлеченный капитал
          </span>
          <div className="text-lg font-black font-mono text-white">
            {metrics.totalCapitalRaised.toLocaleString()} ₽
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Общий процент выплат
          </span>
          <div className="text-lg font-black font-mono text-emerald-400">
            {metrics.overallPayoutRate}%
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Успешно закрыто
          </span>
          <div className="text-lg font-black font-mono text-neutral-300">
            {metrics.successfulClosedCount}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-mono text-neutral-500 block mb-1">
            Банкротств
          </span>
          <div className="text-lg font-black font-mono text-rose-400">
            {metrics.bankruptCount}
          </div>
        </div>
      </div>

      {/* Author's Temkas Catalog with Status Filtering */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800 mb-5">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
              Каталог проектов автора ({temkas.length})
            </h2>
            <p className="text-xs text-neutral-400">Все созданные смарт-контракты создателя</p>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-neutral-800 text-amber-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Все ({temkas.length})
            </button>
            <button
              onClick={() => setStatusFilter('Active')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'Active'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Активные ({metrics.activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('Bankrupt')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'Bankrupt'
                  ? 'bg-rose-500/20 text-rose-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Банкроты ({metrics.bankruptCount})
            </button>
            <button
              onClick={() => setStatusFilter('Closed')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'Closed'
                  ? 'bg-neutral-800 text-neutral-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Закрытые ({metrics.successfulClosedCount})
            </button>
          </div>
        </div>

        {filteredTemkas.length === 0 ? (
          <div className="text-center py-12 text-xs text-neutral-500 font-mono">
            В данной категории проектов нет.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemkas.map((t) => (
              <TemkaCard key={t.id} temka={t} onClick={() => onNavigateTemka(t.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
