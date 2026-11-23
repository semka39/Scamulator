import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { SandboxLog } from '../types';
import { Terminal, X, RefreshCw, AlertCircle, CheckCircle2, Clock, Cpu } from 'lucide-react';

interface SandboxLogsModalProps {
  temkaId: string;
  temkaTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SandboxLogsModal: React.FC<SandboxLogsModalProps> = ({
  temkaId,
  temkaTitle,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<SandboxLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSandboxLogs(temkaId);
      setLogs(res.logs);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить логи песочницы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, temkaId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-3xl max-h-[85vh] rounded-2xl p-6 shadow-2xl flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Логи песочницы Python Sandbox
              </h2>
              <p className="text-xs text-neutral-400 font-mono">Темка: {temkaTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Обновить логи"
              className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sandbox Specifications Info */}
        <div className="mt-3 py-2 px-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" /> Timeout: 2.0s | RAM: 64MB | Mutex FIFO
          </span>
          <span className="text-neutral-500">Atomic State Commits (3MB max)</span>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Logs List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-500 font-mono">
              Логи выполнения еще не сформированы.
            </div>
          ) : (
            logs.map((log) => {
              const isSuccess = log.status === 'SUCCESS';
              const isTimeout = log.status === 'TIMEOUT';

              return (
                <div
                  key={log.id}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 font-mono text-xs text-neutral-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-900 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isTimeout
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="text-neutral-400">Депозит: {log.depositAmount} ₽</span>
                      <span className="text-neutral-500">→</span>
                      <span className="text-emerald-400 font-bold">Выплата: {log.payout} ₽</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.durationMs}ms
                      </span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-400 mb-1">
                    Инвестор (hash): <span className="text-amber-400/80">{log.userHash}</span>
                  </div>

                  {log.stdout && (
                    <div className="mt-2 bg-neutral-900/90 rounded-lg p-2.5 text-neutral-200 border border-neutral-800/80 whitespace-pre-wrap text-[11px]">
                      <span className="text-neutral-500 select-none">[stdout]: </span>
                      {log.stdout}
                    </div>
                  )}

                  {(log.stderr || log.error) && (
                    <div className="mt-2 bg-rose-950/40 border border-rose-900/60 rounded-lg p-2.5 text-rose-300 whitespace-pre-wrap text-[11px]">
                      <span className="text-rose-500 select-none">[stderr/error]: </span>
                      {log.error || log.stderr}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
