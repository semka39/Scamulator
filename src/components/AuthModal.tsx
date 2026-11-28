import React, { useState, useCallback } from 'react';
import { api, setAuthToken } from '../api';
import { User } from '../types';
import { HCaptchaWidget } from './HCaptchaWidget';
import { X, LogIn, UserPlus, Lock, User as UserIcon, AlertCircle, AlertTriangle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setError(null);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      if (password.length < 4) {
        setError('Пароль должен содержать не менее 4 символов');
        return;
      }
      if (password !== confirmPassword) {
        setError('Пароли не совпадают. Проверьте правильность ввода');
        return;
      }
      if (!captchaToken) {
        setError('Пожалуйста, пройдите проверку капчи');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(username, password, captchaToken || undefined);
        setAuthToken(res.token);
        onSuccess(res.user);
        onClose();
      } else {
        const res = await api.login(username, password);
        setAuthToken(res.token);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono">
              {isRegister ? 'Регистрация' : 'Вход в аккаунт'}
            </h2>
            <p className="text-xs text-neutral-400">
              {isRegister
                ? 'Создайте аккаунт, чтобы делать ставки и запускать свои темки'
                : 'Введите ваши учетные данные для авторизации'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Логин
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Например: trader_neo"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Пароль</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Confirm password field for registration */}
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Подтверждение пароля
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль"
                  className={`w-full bg-neutral-950 border rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden transition-colors font-mono ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-rose-500/70 focus:border-rose-500'
                      : confirmPassword && confirmPassword === password
                      ? 'border-emerald-500/70 focus:border-emerald-500'
                      : 'border-neutral-700 focus:border-amber-500'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Warning regarding irreversible password loss */}
          {isRegister && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-[11px] leading-relaxed text-amber-200/90">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-bold block mb-0.5 font-mono">
                  ВАЖНО: Сохраните пароль
                </strong>
                В случае утери пароля восстановление доступа к аккаунту{' '}
                <span className="font-bold underline text-amber-300">НЕВОЗМОЖНО</span> никаким способом (нет привязки к почте или телефону). Обязательно сохраните или запишите его!
              </div>
            </div>
          )}

          {/* hCaptcha for Registration */}
          {isRegister && (
            <HCaptchaWidget
              onVerify={handleCaptchaVerify}
              onExpire={handleCaptchaExpire}
            />
          )}

          <button
            type="submit"
            disabled={loading || (isRegister && !captchaToken)}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer active:scale-98"
          >
            {loading ? 'Обработка...' : isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-neutral-800/80 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setConfirmPassword('');
              setCaptchaToken(null);
            }}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4 cursor-pointer"
          >
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  );
};
