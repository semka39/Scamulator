import React from 'react';
import { TransactionSummary } from '../types';
import { Activity, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface CoefficientFeedProps {
  transactions: TransactionSummary[];
}

export const CoefficientFeed: React.FC<CoefficientFeedProps> = ({ transactions }) => {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
      {/* Header with Privacy Indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Лента коэффициентов
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Суммы скрыты</span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-500 font-mono">
          Транзакций пока нет. Сделайте первую ставку!
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {transactions.map((tx) => {
            let badgeBg = 'bg-neutral-800 text-neutral-300 border-neutral-700';
            let label = `x${tx.multiplier.toFixed(2)}`;

            if (tx.isDefault) {
              badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse font-bold';
              label = `ДЕФОЛТ (x${tx.multiplier.toFixed(2)})`;
            } else if (tx.isRefund) {
              badgeBg = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
              label = 'ВОЗВРАТ (x1.00)';
            } else if (tx.multiplier > 1.0) {
              badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
            } else if (tx.multiplier < 1.0) {
              badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
            }

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 px-3.5 py-2.5 rounded-xl transition-all font-mono text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg border text-xs tracking-wide ${badgeBg}`}>
                    {label}
                  </span>
                  <span className="text-[11px] text-neutral-400 hidden sm:inline">
                    {tx.multiplier >= 1.0 ? 'Прибыль' : 'Срез'}
                  </span>
                </div>

                <div className="text-[11px] text-neutral-500">
                  {new Date(tx.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
