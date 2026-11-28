import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { User, Invoice } from '../types';
import confetti from 'canvas-confetti';
import {
  X,
  CreditCard,
  QrCode,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  ShieldCheck,
  Zap,
  Building2,
  Sparkles,
  Tag,
} from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [100, 500, 1000, 2500, 5000, 10000];

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSuccess,
}) => {
  // Method state: ONLY 'ozon' and 'sbp' allowed
  const [method, setMethod] = useState<'ozon' | 'sbp'>('sbp');
  const [amount, setAmount] = useState('500');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Invoice Screen state
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [invoicePaidSuccess, setInvoicePaidSuccess] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  // History Tab
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [invoicesHistory, setInvoicesHistory] = useState<Invoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [isPromoExpanded, setIsPromoExpanded] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  // Polling ref
  const pollIntervalRef = useRef<any>(null);

  // History Back support for invoice screen
  useEffect(() => {
    if (!activeInvoice) return;

    window.history.pushState({ ...window.history.state, depositStep: 'invoice' }, '');

    const handlePopInvoice = () => {
      stopPolling();
      setActiveInvoice(null);
      setError(null);
    };

    window.addEventListener('popstate', handlePopInvoice, { once: true });
    return () => {
      window.removeEventListener('popstate', handlePopInvoice);
    };
  }, [activeInvoice?.id]);

  const handleBackToCreateForm = () => {
    if (window.history.state?.depositStep === 'invoice') {
      window.history.back();
    } else {
      stopPolling();
      setActiveInvoice(null);
      setError(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setInvoicePaidSuccess(null);
      setPromoError(null);
      setPromoSuccess(null);
      loadHistory();
    } else {
      stopPolling();
      setActiveInvoice(null);
    }
    return () => stopPolling();
  }, [isOpen]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getDepositInvoices();
      setInvoicesHistory(res.invoices);
    } catch {}
    finally {
      setLoadingHistory(false);
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (!activeInvoice || activeInvoice.status !== 'active' || secondsRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = Math.max(0, Math.floor(prev) - 1);
        if (next <= 0) {
          clearInterval(timer);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeInvoice, secondsRemaining]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    setPromoSuccess(null);
    try {
      const res = await api.applyPromoCode(promoCode.trim());
      setPromoSuccess(res.message);
      onSuccess(res.newBalance);
      setPromoCode('');
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } catch (err: any) {
      setPromoError(err.message || 'Ошибка применения промокода');
    } finally {
      setPromoLoading(false);
    }
  };

  // Background polling for active invoice
  const startPolling = (invoiceId: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.checkDepositInvoice(invoiceId);
        if (res.status === 'paid' || res.justCredited) {
          stopPolling();
          setActiveInvoice((prev) => (prev ? { ...prev, status: 'paid', credited: true } : null));
          setInvoicePaidSuccess(res.message || 'Оплата успешно получена!');
          onSuccess(res.newBalance);
          try {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
          } catch {}
          loadHistory();
        } else if (res.status === 'expired' || res.status === 'cancelled') {
          stopPolling();
          setActiveInvoice((prev) => (prev ? { ...prev, status: res.status as any } : null));
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInvoicePaidSuccess(null);

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 100) {
      setError('Минимальная сумма пополнения — 100 ₽');
      return;
    }

    setLoading(true);

    try {
      const res = await api.createDepositInvoice(parsedAmount, method);
      setActiveInvoice(res.invoice);
      setSecondsRemaining(Math.max(0, Math.floor(res.invoice.secondsLeft || 900))); // default 15 min
      startPolling(res.invoice.id);
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Не удалось сформировать счёт на оплату');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (!activeInvoice) return;
    setIsChecking(true);
    setError(null);

    try {
      const res = await api.checkDepositInvoice(activeInvoice.id);
      if (res.status === 'paid' || res.justCredited) {
        stopPolling();
        setActiveInvoice((prev) => (prev ? { ...prev, status: 'paid', credited: true } : null));
        setInvoicePaidSuccess(res.message || 'Оплата подтверждена!');
        onSuccess(res.newBalance);
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        } catch {}
        loadHistory();
      } else {
        setActiveInvoice((prev) => (prev ? { ...prev, status: res.status as any } : null));
        if (res.status === 'active') {
          setError('Платёж ещё не поступил. Если вы уже перевели средства, подождите 10-30 секунд.');
        } else {
          setError(`Статус счёта: ${res.status}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка проверки статуса');
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  const parsedAmount = Number(amount) || 0;
  const isSbp = method === 'sbp';
  const commissionRate = isSbp ? 0.019 : 0;
  const commissionAmount = Math.round(parsedAmount * commissionRate * 100) / 100;
  const totalAmountToPay = parsedAmount + commissionAmount;

  const formatTimer = (totalSeconds: number) => {
    const totalSecsInt = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mins = Math.floor(totalSecsInt / 60);
    const secs = totalSecsInt % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={() => {
            stopPolling();
            onClose();
          }}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-xl transition-colors cursor-pointer hover:bg-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono">Пополнение баланса</h2>
            <p className="text-xs text-neutral-400">
              Моментальный платёжный шлюз (Argon Pay)
            </p>
          </div>
        </div>

        {/* Balance & Sub-Navigation */}
        <div className="flex items-center justify-between bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-neutral-400">Текущий баланс:</span>
            <span className="text-xs font-bold font-mono text-white">
              {currentUser.balance.toLocaleString()} ₽
            </span>
          </div>

          <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setError(null);
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Оплата
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                loadHistory();
              }}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              История счетов ({invoicesHistory.length})
            </button>
          </div>
        </div>

        {activeTab === 'create' ? (
          <div className="overflow-y-auto pr-1 flex-1">
            {invoicePaidSuccess && (
              <div className="mb-4 p-4 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 flex items-start gap-3 animate-in zoom-in-95 duration-150">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-300 text-sm">Баланс успешно пополнен!</h4>
                  <p className="mt-1 leading-relaxed">{invoicePaidSuccess}</p>
                  <p className="text-[11px] text-emerald-400/80 font-mono mt-1">
                    Новый баланс: {currentUser.balance.toLocaleString()} ₽
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Active Invoice Payment Screen */}
            {activeInvoice && activeInvoice.status === 'active' && !invoicePaidSuccess ? (
              <div className="space-y-4 bg-neutral-950 border border-neutral-800 p-4 rounded-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="text-xs font-bold text-amber-400 uppercase font-mono">
                      Счёт ожидает оплаты
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{formatTimer(secondsRemaining)}</span>
                  </div>
                </div>

                {/* Amount to pay */}
                <div className="text-center py-2">
                  <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-mono">
                    К оплате через {activeInvoice.bank === 'ozon' ? 'Озон Банк' : 'СБП'}
                  </span>
                  <div className="text-3xl font-black font-mono text-white mt-1">
                    {(activeInvoice.amountWithCommission || activeInvoice.amount).toLocaleString()} ₽
                  </div>
                  {activeInvoice.amountWithCommission && activeInvoice.amountWithCommission !== activeInvoice.amount && (
                    <span className="text-[11px] text-neutral-500 font-mono">
                      (Зачисление на баланс: {activeInvoice.amount.toLocaleString()} ₽, комиссия 1.9%)
                    </span>
                  )}
                </div>

                {/* Action Buttons: Pay & Check */}
                <div className="space-y-2 pt-1">
                  {activeInvoice.paymentUrl && (
                    <a
                      href={activeInvoice.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Перейти к оплате</span>
                    </a>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleManualCheck}
                      disabled={isChecking}
                      className="py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-200 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>{isChecking ? 'Проверяем...' : 'Проверить оплату'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBackToCreateForm}
                      className="py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-400 hover:text-neutral-200 rounded-xl transition-all cursor-pointer"
                    >
                      Создать другой счёт
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-[11px] text-neutral-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Статус проверяется автоматически каждые 3 секунды. После оплаты баланс обновится моментально.
                  </span>
                </div>
              </div>
            ) : (
              /* Create Invoice Form */
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                {/* Method Selector: Exactly 2 options as requested */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">
                    Выберите платёжную систему
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* SBP Option */}
                    <button
                      type="button"
                      onClick={() => setMethod('sbp')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        method === 'sbp'
                          ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/50'
                          : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs font-mono">
                            СБП
                          </div>
                          <span className="font-bold text-white text-xs">СБП</span>
                        </div>
                        {method === 'sbp' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Оплата через любой банк РФ
                      </p>
                      <span className="text-[10px] font-mono text-amber-400/90 mt-2 block font-medium">
                        Комиссия 1.9%
                      </span>
                    </button>

                    {/* Ozon Bank Option */}
                    <button
                      type="button"
                      onClick={() => setMethod('ozon')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        method === 'ozon'
                          ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/50'
                          : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs font-mono">
                            OZON
                          </div>
                          <span className="font-bold text-white text-xs">Озон Банк</span>
                        </div>
                        {method === 'ozon' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Прямой перевод через Озон
                      </p>
                      <span className="text-[10px] font-mono text-emerald-400 mt-2 block font-medium">
                        0% комиссии
                      </span>
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-300">
                      Сумма пополнения (₽)
                    </label>
                    <span className="text-[11px] font-mono text-neutral-400">
                      Мин. 100 ₽
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      step="1"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1000"
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(String(amt))}
                        className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          parsedAmount === amt
                            ? 'bg-amber-500/20 border border-amber-500 text-amber-300 font-bold'
                            : 'bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300'
                        }`}
                      >
                        {amt.toLocaleString()} ₽
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Зачисление на баланс:</span>
                    <span className="text-white font-bold">{parsedAmount.toLocaleString()} ₽</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Комиссия ({isSbp ? '1.9% СБП' : '0% Озон'}):</span>
                    <span className={commissionAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {commissionAmount > 0 ? `+${commissionAmount.toFixed(2)} ₽` : '0 ₽'}
                    </span>
                  </div>
                  <div className="border-t border-neutral-800 pt-2 flex items-center justify-between text-sm">
                    <span className="text-neutral-200 font-bold">Итого к оплате:</span>
                    <span className="text-amber-400 font-black text-base">
                      {totalAmountToPay.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽
                    </span>
                  </div>
                </div>

                {/* Promo Code section */}
                <div className="pt-0.5">
                  {!isPromoExpanded ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPromoExpanded(true);
                        setPromoError(null);
                        setPromoSuccess(null);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 font-medium cursor-pointer py-1"
                    >
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Применить промокод</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-neutral-950 rounded-xl border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          Активация промокода
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPromoExpanded(false);
                            setPromoError(null);
                            setPromoSuccess(null);
                          }}
                          className="text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer"
                        >
                          Скрыть
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyPromo();
                            }
                          }}
                          placeholder="ВВЕДИТЕ ПРОМОКОД"
                          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono focus:outline-hidden focus:border-amber-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoCode.trim()}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-lg transition-all cursor-pointer font-mono shrink-0"
                        >
                          {promoLoading ? '...' : 'Применить'}
                        </button>
                      </div>
                      {promoSuccess && (
                        <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{promoSuccess}</span>
                        </p>
                      )}
                      {promoError && (
                        <p className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{promoError}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || parsedAmount < 100}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Создание счёта в Argon Pay...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>Сформировать счёт на {totalAmountToPay.toLocaleString()} ₽</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Invoices History Tab */
          <div className="overflow-y-auto pr-1 flex-1 min-h-[260px] space-y-2">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            ) : invoicesHistory.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                История пополнений пуста
              </div>
            ) : (
              invoicesHistory.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">
                        {inv.amount.toLocaleString()} ₽
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono uppercase font-bold ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : inv.status === 'active'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {inv.status === 'paid' ? 'Оплачен' : inv.status === 'active' ? 'Ожидает' : inv.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-neutral-500 font-mono mt-1 flex items-center gap-2">
                      <span>Способ: {inv.bank === 'ozon' ? 'Озон Банк' : 'СБП'}</span>
                      <span>•</span>
                      <span>{new Date(inv.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {inv.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInvoice(inv);
                        setActiveTab('create');
                        setSecondsRemaining(inv.secondsLeft || 600);
                        startPolling(inv.id);
                      }}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Оплатить
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
