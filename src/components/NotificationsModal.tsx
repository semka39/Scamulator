import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { AppNotification, NotificationSettings, NotificationType } from '../types';
import {
  X,
  Bell,
  Settings,
  Trash2,
  Coins,
  AlertTriangle,
  Lock,
  ArrowDownToLine,
  MessageSquare,
  ArrowRightLeft,
  RefreshCw,
} from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTemka: (temkaId: string) => void;
  onNavigateProfile: (userId: string) => void;
  onUnreadCountChanged: (count: number) => void;
}

const SETTING_ITEMS: Array<{
  key: keyof NotificationSettings;
  label: string;
  description: string;
}> = [
  {
    key: 'new_bet',
    label: 'Новая ставка в темке',
    description: 'Уведомлять, когда кто-то делает ставку в вашу темку',
  },
  {
    key: 'temka_bankrupt',
    label: 'Темка разорена',
    description: 'Уведомлять, если банк вашей темки закончился',
  },
  {
    key: 'temka_closed',
    label: 'Темка закрыта',
    description: 'Уведомлять, когда темка закрывается с возвратом залога',
  },
  {
    key: 'withdrawal_executed',
    label: 'Успешный вывод',
    description: 'Уведомлять, когда сработала ваша заявка на вывод из темки',
  },
  {
    key: 'new_comment',
    label: 'Новый комментарий',
    description: 'Уведомлять о новых отзывах и комментариях в ваших темках',
  },
  {
    key: 'transfer_received',
    label: 'Входящий перевод',
    description: 'Уведомлять, когда другой игрок переводит вам деньги',
  },
];

function getNotifIcon(type: NotificationType) {
  switch (type) {
    case 'new_bet':
      return <Coins className="w-4 h-4 text-amber-400" />;
    case 'temka_bankrupt':
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    case 'temka_closed':
      return <Lock className="w-4 h-4 text-neutral-400" />;
    case 'withdrawal_executed':
      return <ArrowDownToLine className="w-4 h-4 text-emerald-400" />;
    case 'new_comment':
      return <MessageSquare className="w-4 h-4 text-sky-400" />;
    case 'transfer_received':
      return <ArrowRightLeft className="w-4 h-4 text-emerald-400" />;
  }
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigateTemka,
  onNavigateProfile,
  onUnreadCountChanged,
}) => {
  const [tab, setTab] = useState<'list' | 'settings'>('list');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [notifsRes, settingsRes] = await Promise.all([
        api.getNotifications(),
        silent ? Promise.resolve(null) : api.getNotificationSettings(),
      ]);
      setNotifications(notifsRes.notifications);
      onUnreadCountChanged(notifsRes.unreadCount);
      if (settingsRes) {
        setSettings(settingsRes.settings);
      }
    } catch (err) {
      if (!silent) console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load + live polling while modal is open + mark read on close
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      setTab('list');
      loadData(false);

      const poll = setInterval(() => {
        if (!document.hidden) {
          loadData(true);
        }
      }, 3000);

      return () => clearInterval(poll);
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      onUnreadCountChanged(0);
      api.markNotificationsRead().catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    try {
      await api.clearNotifications();
      setNotifications([]);
      onUnreadCountChanged(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await api.deleteNotification(id);
      onUnreadCountChanged(res.unreadCount);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.temkaId) {
      onNavigateTemka(notif.temkaId);
    } else if (notif.relatedUserId) {
      onNavigateProfile(notif.relatedUserId);
    }
  };

  const handleToggleSetting = async (key: keyof NotificationSettings) => {
    if (!settings) return;
    const nextVal = !settings[key];
    setSavingKey(key);
    setSettings({ ...settings, [key]: nextVal });
    try {
      const res = await api.updateNotificationSettings({ [key]: nextVal });
      setSettings(res.settings);
    } catch (err) {
      setSettings({ ...settings, [key]: !nextVal });
      console.error(err);
    } finally {
      setSavingKey(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[88vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-xl transition-colors cursor-pointer hover:bg-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono">Уведомления</h2>
            <p className="text-xs text-neutral-400">События по вашим темкам и переводам</p>
          </div>
        </div>

        {/* Tabs + Permanent Clear All button */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-800 mb-3">
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                tab === 'list'
                  ? 'bg-amber-500 text-neutral-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Лента</span>
              {unreadCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    tab === 'list' ? 'bg-neutral-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                tab === 'settings'
                  ? 'bg-amber-500 text-neutral-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Настройки</span>
            </button>
          </div>

          {tab === 'list' && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={notifications.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40 disabled:pointer-events-none font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить всё</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="py-12 flex items-center justify-center text-neutral-500 gap-2 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Загрузка...</span>
            </div>
          ) : tab === 'list' ? (
            notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                Уведомлений пока нет.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group p-3 rounded-xl border transition-all ${
                    notif.temkaId || notif.relatedUserId ? 'cursor-pointer hover:border-amber-500/40' : ''
                  } ${
                    notif.isRead
                      ? 'bg-neutral-950/60 border-neutral-800/80 text-neutral-400'
                      : 'bg-neutral-950 border-amber-500/30 text-neutral-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                      {getNotifIcon(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[10px] font-mono text-neutral-500">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteOne(e, notif.id)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-opacity cursor-pointer"
                          title="Удалить уведомление"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Удалить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="space-y-2">
              {settings &&
                SETTING_ITEMS.map((item) => {
                  const enabled = settings[item.key];
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-xl cursor-pointer hover:border-neutral-700 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{item.label}</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">{item.description}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        disabled={savingKey === item.key}
                        onClick={() => handleToggleSetting(item.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          enabled ? 'bg-amber-500' : 'bg-neutral-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-neutral-950 transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
