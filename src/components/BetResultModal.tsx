import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, RefreshCw, X, ShieldAlert, ArrowRight } from 'lucide-react';

interface BetResultModalProps {
  isOpen: boolean;
  isLoading: boolean;
  betAmount: number;
  result: {
    payout: number;
    multiplier: number;
    isDefault: boolean;
    isRefund: boolean;
    message: string;
    stdout?: string;
    stderr?: string;
  } | null;
  error: string | null;
  onClose: () => void;
  onBetAgain?: () => void;
}

export const BetResultModal: React.FC<BetResultModalProps> = ({
  isOpen,
  isLoading,
  betAmount,
  result,
  error,
  onClose,
  onBetAgain,
}) => {
  if (!isOpen) return null;

  const isWin = result ? result.payout >= betAmount && !result.isRefund && !result.isDefault : false;
  const isLoss = result ? result.payout < betAmount && !result.isRefund && !result.isDefault : false;
  const netProfit = result ? result.payout - betAmount : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {!isLoading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors z-10"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-10 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
              <div className="w-full h-full rounded-full border-4 border-amber-500 border-t-transparent animate-spin flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1.5 font-mono">
                Исполнение смарт-контракта...
              </h3>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                Алгоритм Python 3.10 обрабатывает депозит <strong className="text-amber-300">{betAmount.toLocaleString()} ₽</strong>
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Атомарная фиксация состояния
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Ошибка ставки</h3>
              <p className="text-xs text-rose-300/90 max-w-sm mx-auto leading-relaxed bg-rose-950/30 p-3 rounded-xl border border-rose-500/20">
                {error}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {/* Success / Result State */}
        {!isLoading && result && (
          <div className="space-y-5">
            {/* Top Badge & Header */}
            <div className="text-center pt-2">
              {result.isDefault ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 border border-rose-500/40 rounded-full text-rose-400 text-xs font-bold font-mono mb-3">
                  <ShieldAlert className="w-4 h-4" />
                  ДЕФОЛТ СМАРТ-КОНТРАКТА
                </div>
              ) : result.isRefund ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 text-xs font-bold font-mono mb-3">
                  <RefreshCw className="w-4 h-4" />
                  ВОЗВРАТ ДЕПОЗИТА
                </div>
              ) : isWin ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-400 text-xs font-bold font-mono mb-3">
                  <Sparkles className="w-4 h-4" />
                  ВЫИГРЫШ
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-800 border border-neutral-700 rounded-full text-neutral-300 text-xs font-bold font-mono mb-3">
                  <TrendingDown className="w-4 h-4 text-amber-400" />
                  РЕЗУЛЬТАТ СТАВКИ
                </div>
              )}

              {/* Huge Animated Multiplier Display */}
              <div
                className={`text-5xl font-black font-mono tracking-tight my-2 ${
                  result.isDefault
                    ? 'text-rose-400'
                    : isWin
                    ? 'text-emerald-400'
                    : isLoss
                    ? 'text-amber-400'
                    : 'text-neutral-200'
                }`}
              >
                x{result.multiplier.toFixed(2)}
              </div>

              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {result.message}
              </p>
            </div>

            {/* Financial Details Table */}
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between text-neutral-400">
                <span>Сумма ставки:</span>
                <span className="font-bold text-white">{betAmount.toLocaleString()} ₽</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Множитель выигрыша:</span>
                <span className="font-bold text-amber-400">x{result.multiplier.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400 border-t border-neutral-800 pt-2">
                <span>Итоговая выплата:</span>
                <span
                  className={`font-black text-sm ${
                    result.payout > 0 ? 'text-emerald-400' : 'text-neutral-400'
                  }`}
                >
                  {result.payout.toLocaleString()} ₽
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Чистый результат:</span>
                <span
                  className={`font-bold ${
                    netProfit > 0
                      ? 'text-emerald-400'
                      : netProfit < 0
                      ? 'text-rose-400'
                      : 'text-neutral-400'
                  }`}
                >
                  {netProfit > 0 ? `+${netProfit.toLocaleString()} ₽` : `${netProfit.toLocaleString()} ₽`}
                </span>
              </div>
            </div>

            {/* Execution logs / traces if present */}
            {(result.stdout || result.stderr) && (
              <details className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-2.5 text-[11px] font-mono group">
                <summary className="text-neutral-400 hover:text-amber-300 cursor-pointer select-none font-semibold flex items-center justify-between">
                  <span>Журнал исполнения Python</span>
                  <span className="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-2 pt-2 border-t border-neutral-800/80 space-y-1.5 max-h-36 overflow-y-auto">
                  {result.stdout && (
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">stdout:</div>
                      <pre className="text-neutral-300 whitespace-pre-wrap">{result.stdout}</pre>
                    </div>
                  )}
                  {result.stderr && (
                    <div>
                      <div className="text-[10px] text-rose-400 uppercase">stderr / trace:</div>
                      <pre className="text-rose-300 whitespace-pre-wrap">{result.stderr}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs rounded-xl transition-colors text-center"
              >
                Закрыть
              </button>
              {onBetAgain && !result.isDefault && (
                <button
                  onClick={() => {
                    onClose();
                    onBetAgain();
                  }}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>Повторить</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
