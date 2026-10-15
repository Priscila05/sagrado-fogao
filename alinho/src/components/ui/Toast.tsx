import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { createId } from '../../utils/id';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  detail?: string;
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: ToastTone; detail?: string; durationMs?: number }) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, { icon: typeof Check; className: string }> = {
  success: { icon: Check, className: 'text-positive' },
  error: { icon: AlertTriangle, className: 'text-critical' },
  info: { icon: Info, className: 'text-accent' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback<ToastContextValue['notify']>(
    (message, options) => {
      const id = createId();
      const tone = options?.tone ?? 'info';
      setToasts((current) => [...current.slice(-3), { id, tone, message, detail: options?.detail }]);
      const duration = options?.durationMs ?? (tone === 'error' ? 7000 : 3600);
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (message, detail) => notify(message, { tone: 'success', detail }),
      error: (message, detail) => notify(message, { tone: 'error', detail }),
      dismiss,
    }),
    [notify, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:translate-x-0"
        role="region"
        aria-label="Notificações"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = TONE_STYLE[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className="pointer-events-auto flex items-start gap-2.5 rounded-md border border-line bg-raised px-3.5 py-3 shadow-pop animate-slide-up"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{toast.message}</p>
                {toast.detail ? <p className="mt-0.5 text-xs text-muted">{toast.detail}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="focus-ring -mr-1 -mt-1 rounded p-1 text-subtle transition-colors hover:text-ink"
                aria-label="Fechar notificação"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return context;
}
