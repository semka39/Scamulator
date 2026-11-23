import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Temka, FilterState } from '../types';
import { CatalogFilters } from './CatalogFilters';
import { TemkaCard } from './TemkaCard';
import { RefreshCw, Layers, Sparkles, AlertCircle } from 'lucide-react';

interface CatalogViewProps {
  onSelectTemka: (temkaId: string) => void;
  onSelectAuthor: (authorId: string) => void;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: ['Active'],
  minCapital: '',
  maxCapital: '',
  minCollateral: '',
  maxCollateral: '',
  minBet: '',
  maxBet: '',
  minTotalIn: '',
  maxTotalIn: '',
  minTotalOut: '',
  maxTotalOut: '',
  minRtp: '',
  maxRtp: '',
  minDeals: '',
  maxDeals: '',
  minWithdrawalRatio: '',
  maxWithdrawalRatio: '',
  maxAgeHours: '',
  sortBy: 'capital',
  sortDir: 'desc',
};

export const CatalogView: React.FC<CatalogViewProps> = ({ onSelectTemka, onSelectAuthor }) => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [temkas, setTemkas] = useState<Temka[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemkas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTemkas(filters);
      setTemkas(res.temkas);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки каталога темок');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemkas();
  }, [filters]);

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner / Heading */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-bold">
                Свободный рынок смарт-контрактов
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Каталог финансовых алгоритмов и темок
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Исследуйте смарт-контракты под управлением скриптов Python, анализируйте показатели RTP и
              залог авторов в режиме реального времени.
            </p>
          </div>

          <button
            onClick={fetchTemkas}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-mono transition-all self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* Catalog Deep Search & Filter System (Section 6) */}
      <CatalogFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        totalResultsCount={temkas.length}
      />

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-2xl text-xs text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Temka Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : temkas.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xl">
          <Layers className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Темки не найдены</h3>
          <p className="text-xs text-neutral-400 mb-6">
            По заданным фильтрам и критериям поиска ничего не найдено. Попробуйте ослабить условия.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Сбросить все фильтры
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {temkas.map((temka) => (
            <TemkaCard
              key={temka.id}
              temka={temka}
              onClick={() => onSelectTemka(temka.id)}
              onAuthorClick={onSelectAuthor}
            />
          ))}
        </div>
      )}
    </div>
  );
};
