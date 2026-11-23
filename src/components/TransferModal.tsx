import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User } from '../types';
import {
  X,
  Send,
  ArrowRightLeft,
  Coins,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  currentUser: User;
  initialRecipient?: string;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  currentUser,
  initialRecipient = '',
  onClose,
  onSuccess,
}) => {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialRecipient) {
        setRecipient(initialRecipient.replace(/^@/, ''));
      }
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialRecipient]);

  if (!isOpen) return null;

  const parsedAmount = Math.floor(Number(amount)) || 0;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!recipient.trim()) {
      setError('Укажите логин получателя');
      return;
    }

    if (parsedAmount <= 0) {
      setError('Сумма перевода должна быть больше 0 ₽');
      return;
    }

    if (parsedAmount > currentUser.balance) {
      setError(`Недостаточно средств. Ваш баланс: ${currentUser.balance.toLocaleString()} ₽`);
      return;
    }

    setLoading(true);

    try {
      const res = await api.transfer(recipient.trim(), parsedAmount, comment.trim() || undefined);
      setSuccessMsg(res.message);
      onSuccess(res.newBalance);
      setAmount('');
      setComment('');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки перевода');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-xl transition-colors cursor-pointer hover:bg-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono">Перевод средств</h2>
            <p className="text-xs text-neutral-400">
              Мгновенный перевод рублей между аккаунтами без комиссии
            </p>
          </div>
        </div>

        {/* Balance Bar */}
        <div className="flex items-center justify-between bg-neutral-950 p-3 rounded-xl border border-neutral-800 mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-neutral-400">Доступный баланс:</span>
          </div>
          <span className="text-sm font-bold font-mono text-emerald-400">
            {currentUser.balance.toLocaleString()} ₽
          </span>
        </div>

        <div className="overflow-y-auto pr-1">
          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-300">Перевод выполнен!</p>
                <p className="mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            {/* Recipient Input */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Получатель (логин)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-500 font-mono text-sm">@</span>
                <input
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.replace(/^@/, ''))}
                  placeholder="investor_pro"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-300">
                  Сумма перевода (₽)
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(String(currentUser.balance))}
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  Вся сумма: {currentUser.balance.toLocaleString()} ₽
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={currentUser.balance}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition-colors font-mono"
                />
              </div>

              {/* Quick amount chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className="px-2.5 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 rounded-lg text-xs font-mono text-neutral-300 transition-all cursor-pointer"
                  >
                    +{q.toLocaleString()} ₽
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Comment */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Комментарий к переводу (опционально)
              </label>
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  maxLength={200}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Возврат долга / Инвестиции в смарт-контракт"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !recipient.trim() || parsedAmount <= 0 || parsedAmount > currentUser.balance}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98 min-h-[44px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Отправка перевода...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Перевести {parsedAmount > 0 ? `${parsedAmount.toLocaleString()} ₽` : ''}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

