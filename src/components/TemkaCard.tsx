import React from 'react';
import { Temka } from '../types';
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  Flame,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  User as UserIcon,
  Activity,
  Layers,
} from 'lucide-react';

interface TemkaCardProps {
  temka: Temka;
  onClick: () => void;
  onAuthorClick?: (authorId: string) => void;
}

export const TemkaCard: React.FC<TemkaCardProps> = ({ temka, onClick, onAuthorClick }) => {
  const rtp = temka.totalIn > 0 ? Math.round((temka.totalOut / temka.totalIn) * 1000) / 10 : 0;

  const statusConfig = {
    Active: {
      label: 'Активен',
      bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400 animate-pulse',
    },
    Bankrupt: {
      label: 'Банкрот',
      bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      dot: 'bg-rose-400',
    },
    Closed: {
      label: 'Закрыт автором',
      bg: 'bg-neutral-800 text-neutral-400 border-neutral-700',
      dot: 'bg-neutral-500',
    },
  }[temka.status];

  return (
    <div
      id={`temka-card-${temka.id}`}
      onClick={onClick}
      className="group bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
    >
      {/* Top Banner for Active Withdrawal Danger Zone */}
      {Boolean(temka.activeWithdrawalAmount && temka.activeWithdrawalAmount > 0 && temka.status === 'Active') && (
        <div className="-mx-5 -mt-5 mb-3.5 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] font-mono text-amber-300">
          <span className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
            <span>Вывод владельца: <strong className="text-amber-200">{temka.activeWithdrawalRatio}%</strong> от пула</span>
          </span>
          <span className="text-neutral-300 text-[10px] sm:text-[11px]">
            Осталось депозитов: <strong className="text-white">{temka.depositsLeftForWithdrawal ?? 0}</strong>/10
          </span>
        </div>
      )}

      <div>
        {/* Header: Status + Author */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAuthorClick?.(temka.ownerId);
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-300 transition-colors font-mono"
            title={`Профиль автора @${temka.ownerUsername}`}
          >
            {temka.ownerAvatarUrl ? (
              <img
                src={temka.ownerAvatarUrl}
                alt={temka.ownerUsername}
                className="w-4 h-4 rounded-full object-cover ring-1 ring-neutral-700"
              />
            ) : (
              <UserIcon className="w-3.5 h-3.5" />
            )}
            <span>@{temka.ownerUsername}</span>
          </button>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1 mb-1.5">
          {temka.title}
        </h3>
        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed mb-4">
          {temka.description}
        </p>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3 mb-4">
          {/* Capital */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 block mb-0.5">
              Пул ликвидности
            </span>
            <div className="flex items-center gap-1 font-mono font-bold text-sm text-emerald-400">
              <Coins className="w-3.5 h-3.5" />
              <span>{temka.capital.toLocaleString()} ₽</span>
            </div>
          </div>

          {/* Collateral */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 block mb-0.5">
              Залог автора
            </span>
            <div className="flex items-center gap-1 font-mono font-bold text-sm text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{temka.collateral.toLocaleString()} ₽</span>
            </div>
          </div>

          {/* RTP */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 block mb-0.5">
              RTP / Выплаты
            </span>
            <div
              className={`flex items-center gap-1 font-mono font-bold text-xs ${
                rtp >= 100 ? 'text-emerald-400' : rtp >= 75 ? 'text-amber-300' : 'text-rose-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{rtp}%</span>
            </div>
          </div>

          {/* Bet Range */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 block mb-0.5">
              Диапазон ставок
            </span>
            <div className="flex items-center gap-1 font-mono text-xs text-neutral-300">
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              <span>
                {temka.minBet} — {temka.maxBet} ₽
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Deals count + Action CTA */}
      <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-neutral-500" />
            {temka.dealsCount} сделок
          </span>
          <span>Вход: {temka.totalIn.toLocaleString()} ₽</span>
        </div>

        <div className="flex items-center gap-1 text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform">
          <span>{temka.status === 'Active' ? 'Войти в темку' : 'Аналитика'}</span>
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
