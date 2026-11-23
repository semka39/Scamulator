import React, { useState } from 'react';
import { FilterState } from '../types';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Zap,
  Flame,
  Crown,
  Skull,
  Coins,
} from 'lucide-react';

interface CatalogFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  totalResultsCount: number;
}

export const CatalogFilters: React.FC<CatalogFiltersProps> = ({
  filters,
  onChange,
  onReset,
  totalResultsCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const presets = [
    {
      id: 'whale',
      title: 'Китовые хранилища',
      icon: Crown,
      color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      apply: () => {
        setActivePreset('whale');
        onChange({
          ...filters,
          status: ['Active'],
          minCapital: '5000',
          maxCapital: '',
          minWithdrawalRatio: '',
          maxWithdrawalRatio: '',
          minRtp: '',
          maxRtp: '',
          minDeals: '',
          maxDeals: '',
          maxAgeHours: '',
          sortBy: 'capital',
          sortDir: 'desc',
        });
      },
    },
    {
      id: 'liquidation',
      title: 'Зона ликвидации',
      icon: Skull,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      apply: () => {
        setActivePreset('liquidation');
        onChange({
          ...filters,
          status: ['Active'],
          minCapital: '',
          maxCapital: '',
          minWithdrawalRatio: '80',
          maxWithdrawalRatio: '',
          minRtp: '',
          maxRtp: '',
          minDeals: '',
          maxDeals: '',
          maxAgeHours: '',
          sortBy: 'withdrawalVolume',
          sortDir: 'desc',
        });
      },
    },
    {
      id: 'golden_mine',
      title: 'Золотая жила',
      icon: Coins,
      color: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
      apply: () => {
        setActivePreset('golden_mine');
        onChange({
          ...filters,
          status: ['Active'],
          minCapital: '',
          maxCapital: '',
          minWithdrawalRatio: '',
          maxWithdrawalRatio: '',
          minRtp: '105',
          maxRtp: '',
          minDeals: '50',
          maxDeals: '',
          maxAgeHours: '',
          sortBy: 'rtp',
          sortDir: 'desc',
        });
      },
    },
    {
      id: 'fresh_blood',
      title: 'Свежая кровь',
      icon: Zap,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
      apply: () => {
        setActivePreset('fresh_blood');
        onChange({
          ...filters,
          status: ['Active'],
          minCapital: '',
          maxCapital: '',
          minWithdrawalRatio: '',
          maxWithdrawalRatio: '',
          minRtp: '',
          maxRtp: '',
          minDeals: '5',
          maxDeals: '50',
          maxAgeHours: '24',
          sortBy: 'createdAt',
          sortDir: 'desc',
        });
      },
    },
    {
      id: 'meat_grinder',
      title: 'Мясорубка',
      icon: Flame,
      color: 'text-red-400 bg-red-500/10 border-red-500/30',
      apply: () => {
        setActivePreset('meat_grinder');
        onChange({
          ...filters,
          status: ['Active'],
          minCapital: '',
          maxCapital: '',
          minTotalIn: '10000',
          maxTotalIn: '',
          minRtp: '',
          maxRtp: '40',
          minDeals: '',
          maxDeals: '',
          maxAgeHours: '',
          minWithdrawalRatio: '',
          maxWithdrawalRatio: '',
          sortBy: 'deals',
          sortDir: 'desc',
        });
      },
    },
  ];

  const toggleStatus = (statusVal: string) => {
    setActivePreset(null);
    let newStatuses = [...filters.status];
    if (newStatuses.includes(statusVal)) {
      newStatuses = newStatuses.filter((s) => s !== statusVal);
    } else {
      newStatuses.push(statusVal);
    }
    onChange({ ...filters, status: newStatuses });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset(null);
    onChange({ ...filters, search: e.target.value });
  };

  const handleFieldChange = (field: keyof FilterState, val: string) => {
    setActivePreset(null);
    onChange({ ...filters, [field]: val });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl mb-6">
      {/* Top Row: Search + Quick Presets + Expand toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        {/* Search Field */}
        <div className="relative flex-1 w-full min-w-0">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3 sm:top-2.5" />
          <input
            type="text"
            value={filters.search}
            onChange={handleTextChange}
            placeholder="Поиск по названию, описанию или никнейму..."
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-10 pr-9 py-2.5 sm:py-2 text-base sm:text-sm text-white placeholder:text-neutral-500 focus:outline-hidden focus:border-amber-500 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => handleFieldChange('search', '')}
              className="absolute right-3 top-3 sm:top-2.5 text-xs text-neutral-400 hover:text-white p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Multi-Select Pills & Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2">
          {/* Status Multi-Select Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-neutral-400 font-medium mr-0.5 hidden xs:inline">Статус:</span>
            {(['Active', 'Bankrupt', 'Closed'] as const).map((st) => {
              const isSelected = filters.status.includes(st);
              const statusConfig = {
                Active: { label: 'Активные', activeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' },
                Bankrupt: { label: 'Обанкроченные', activeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' },
                Closed: { label: 'Закрытые', activeBg: 'bg-neutral-700/60 text-neutral-300 border-neutral-600 font-bold' },
              }[st];

              return (
                <button
                  key={st}
                  onClick={() => toggleStatus(st)}
                  className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all min-h-[36px] flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? statusConfig.activeBg
                      : 'bg-neutral-950/60 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {statusConfig.label}
                </button>
              );
            })}
          </div>

          {/* Controls: Expand Drawer + Reset */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all min-h-[36px] cursor-pointer ${
                isExpanded
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-neutral-950 text-neutral-300 border-neutral-700 hover:border-neutral-600'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Параметрический фильтр</span>
              <span className="sm:hidden">Фильтры</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                setActivePreset(null);
                onReset();
              }}
              title="Сбросить все фильтры"
              className="p-2 text-neutral-400 hover:text-white bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-fill Presets Bar (Section 6.2) */}
      <div className="mt-3 pt-3 border-t border-neutral-800/80">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 flex-nowrap sm:flex-wrap">
          <span className="text-xs font-medium text-amber-400 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Шаблоны:</span>
          </span>

          {presets.map((p) => {
            const Icon = p.icon;
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={p.apply}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[32px] ${
                  isActive
                    ? 'ring-2 ring-amber-400 bg-neutral-950 font-bold ' + p.color
                    : p.color + ' opacity-80 hover:opacity-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {p.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded Deep Parametric Filter Matrix */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs animate-in fade-in duration-200">
          {/* Capital Range */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Капитал темки (₽)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min"
                value={filters.minCapital}
                onChange={(e) => handleFieldChange('minCapital', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-neutral-500">—</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxCapital}
                onChange={(e) => handleFieldChange('maxCapital', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Collateral Range */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Залог автора (₽)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min"
                value={filters.minCollateral}
                onChange={(e) => handleFieldChange('minCollateral', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-neutral-500">—</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxCollateral}
                onChange={(e) => handleFieldChange('maxCollateral', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* RTP % */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">RTP / Выплаты (%)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Мин % (105)"
                value={filters.minRtp}
                onChange={(e) => handleFieldChange('minRtp', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-neutral-500">—</span>
              <input
                type="number"
                placeholder="Макс % (40)"
                value={filters.maxRtp}
                onChange={(e) => handleFieldChange('maxRtp', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Deals Count */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Число сделок (N)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min"
                value={filters.minDeals}
                onChange={(e) => handleFieldChange('minDeals', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-neutral-500">—</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxDeals}
                onChange={(e) => handleFieldChange('maxDeals', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Active Withdrawal Ratio % */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">% вывода от капитала</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Мин % (80)"
                value={filters.minWithdrawalRatio}
                onChange={(e) => handleFieldChange('minWithdrawalRatio', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-neutral-500">—</span>
              <input
                type="number"
                placeholder="Макс %"
                value={filters.maxWithdrawalRatio}
                onChange={(e) => handleFieldChange('maxWithdrawalRatio', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Total In Volume */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Объем вложений (Σ In)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Мин (10000)"
                value={filters.minTotalIn}
                onChange={(e) => handleFieldChange('minTotalIn', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-neutral-500">—</span>
              <input
                type="number"
                placeholder="Макс"
                value={filters.maxTotalIn}
                onChange={(e) => handleFieldChange('maxTotalIn', e.target.value)}
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Age in Hours */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Возраст темки (макс. часов)</label>
            <input
              type="number"
              placeholder="Например: 24"
              value={filters.maxAgeHours}
              onChange={(e) => handleFieldChange('maxAgeHours', e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>

          {/* Sorting Field & Direction */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Сортировка</label>
            <div className="flex items-center gap-1.5">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFieldChange('sortBy', e.target.value as any)}
                className="w-2/3 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
              >
                <option value="capital">По капиталу</option>
                <option value="rtp">По RTP (%)</option>
                <option value="deals">По числу сделок</option>
                <option value="createdAt">По дате создания</option>
                <option value="withdrawalVolume">По объему вывода</option>
              </select>

              <button
                onClick={() =>
                  handleFieldChange('sortDir', filters.sortDir === 'desc' ? 'asc' : 'desc')
                }
                title={`Порядок: ${filters.sortDir === 'desc' ? 'По убыванию (DESC)' : 'По возрастанию (ASC)'}`}
                className="w-1/3 flex items-center justify-center gap-1 bg-neutral-950 border border-neutral-700 hover:border-neutral-600 rounded-lg py-1.5 text-neutral-300 hover:text-white"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{filters.sortDir.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Count bar */}
      <div className="mt-3 pt-2.5 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800/40">
        <span>
          Найдено темок: <strong className="text-white font-mono">{totalResultsCount}</strong>
        </span>
        {activePreset && (
          <span className="text-amber-400/90 font-mono">
            Применен пресет: {presets.find((p) => p.id === activePreset)?.title}
          </span>
        )}
      </div>
    </div>
  );
};
