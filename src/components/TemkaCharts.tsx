import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TransactionSummary, Temka } from '../types';
import { Activity, BarChart3, PieChart as PieIcon, TrendingUp, Zap } from 'lucide-react';

interface TemkaChartsProps {
  temka: Temka;
  transactions: TransactionSummary[];
}

export const TemkaCharts: React.FC<TemkaChartsProps> = ({ temka, transactions }) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'liquidity' | 'pie'>('feed');

  // Multipliers history (ordered chronologically from oldest to newest)
  const multiplierData = [...transactions]
    .reverse()
    .map((tx, idx) => ({
      index: idx + 1,
      multiplier: Number(tx.multiplier.toFixed(2)),
      isDefault: tx.isDefault,
      isRefund: tx.isRefund,
      time: new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));

  // If no transactions yet, show initial placeholder trend
  const chartPoints =
    multiplierData.length > 0
      ? multiplierData
      : [
          { index: 1, multiplier: 1.0, time: 'Старт' },
          { index: 2, multiplier: temka.maxMultiplier || 1.1, time: 'Сейчас' },
        ];

  // Liquidity breakdown
  const barData = [
    { name: 'Капитал', value: temka.capital, fill: '#10b981' },
    { name: 'Залог', value: temka.collateral, fill: '#f59e0b' },
    { name: 'Сумма In', value: temka.totalIn, fill: '#3b82f6' },
    { name: 'Сумма Out', value: temka.totalOut, fill: '#ec4899' },
  ];

  // Pie breakdown
  const pieData = [
    { name: 'Капитал пула', value: Math.max(1, temka.capital), color: '#10b981' },
    { name: 'Залог автора', value: Math.max(1, temka.collateral), color: '#f59e0b' },
    { name: 'Выплачено игрокам', value: Math.max(1, temka.totalOut), color: '#6366f1' },
  ];

  const rtp = temka.totalIn > 0 ? Math.round((temka.totalOut / temka.totalIn) * 1000) / 10 : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Аналитика и графики смарт-контракта
          </h3>
        </div>

        {/* Tab Controls */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800/80 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-colors min-h-[32px] cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="truncate">График K</span>
          </button>

          <button
            onClick={() => setActiveTab('liquidity')}
            className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-colors min-h-[32px] cursor-pointer ${
              activeTab === 'liquidity'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="truncate">Ликвидность</span>
          </button>

          <button
            onClick={() => setActiveTab('pie')}
            className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-colors min-h-[32px] cursor-pointer ${
              activeTab === 'pie'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span className="truncate">Оборот</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-56 sm:h-64 w-full pt-1">
        {activeTab === 'feed' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="multiplierGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="index" stroke="#737373" fontSize={10} tickLine={false} />
              <YAxis stroke="#737373" fontSize={10} domain={['auto', 'auto']} tickFormatter={(v) => `x${v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #262626',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
                formatter={(value: any) => [`x${value}`, 'Множитель']}
                labelFormatter={(label: any) => `Сделка #${label}`}
              />
              <Area
                type="monotone"
                dataKey="multiplier"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#multiplierGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'liquidity' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis dataKey="name" stroke="#737373" fontSize={11} tickLine={false} />
              <YAxis stroke="#737373" fontSize={10} tickFormatter={(v) => `${v >= 1000 ? `${v / 1000}k` : v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #262626',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
                formatter={(value: any) => [`${Number(value).toLocaleString()} ₽`, 'Объем']}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'pie' && (
          <div className="w-full h-full flex flex-col items-center justify-between">
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #262626',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} ₽`, `${name || 'Объем'}`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Pie Legends */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px] font-mono">
              {pieData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-neutral-950 px-2 py-0.5 rounded-lg border border-neutral-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-neutral-400">{item.name}:</span>
                  <span className="text-neutral-200 font-bold">{item.value.toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick metrics footer */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800 text-center">
        <div className="bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/60">
          <span className="text-[10px] text-neutral-500 font-mono block">Всего сделок</span>
          <span className="text-xs font-black font-mono text-white">{temka.dealsCount}</span>
        </div>
        <div className="bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/60">
          <span className="text-[10px] text-neutral-500 font-mono block">Рекордный xK</span>
          <span className="text-xs font-black font-mono text-amber-400">
            x{temka.maxMultiplier > 0 ? temka.maxMultiplier.toFixed(2) : '—'}
          </span>
        </div>
        <div className="bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/60">
          <span className="text-[10px] text-neutral-500 font-mono block">Расчетный RTP</span>
          <span
            className={`text-xs font-black font-mono ${
              rtp >= 100 ? 'text-emerald-400' : 'text-neutral-300'
            }`}
          >
            {rtp}%
          </span>
        </div>
      </div>
    </div>
  );
};
