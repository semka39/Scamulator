import React, { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Check, X, ExternalLink } from 'lucide-react';

export const InAppBrowserBanner: React.FC = () => {
  const [isInApp, setIsInApp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      const isEmbedded = /Telegram|VK|Vkontakte|Instagram|FBAV|FBAN|Snapchat|Line|MicroMessenger|WeChat/i.test(ua);
      
      const isDismissed = sessionStorage.getItem('dismiss_inapp_banner') === '1';
      if (isEmbedded && !isDismissed) {
        setIsInApp(true);
      }
    } catch (e) {
      // Ignore detection errors
    }
  }, []);

  if (!isInApp || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('dismiss_inapp_banner', '1');
    } catch (e) {}
  };

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  return (
    <aside aria-label="Предупреждение о браузере" className="bg-gradient-to-r from-amber-950/90 via-neutral-900/95 to-amber-950/90 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200/90 relative z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 flex-1 pr-6 sm:pr-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <p className="leading-relaxed">
            <span className="font-semibold text-amber-300">Внимание:</span> Сайт открыт во встроенном веб-просмотре приложения (Telegram / соцсеть). В таких браузерах платформа может работать нестабильно. Рекомендуем открыть ссылку в любом полноценном браузере (Safari, Chrome, Firefox, Opera и др.).
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 rounded-md font-medium transition-colors"
            title="Скопировать ссылку на текущую страницу"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1 text-amber-400/60 hover:text-amber-300 rounded hover:bg-amber-500/10 transition-colors"
            title="Закрыть уведомление"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
