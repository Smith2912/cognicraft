import React from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastType, string> = {
  info: 'border-blue-500/60 bg-blue-950/70 text-blue-100',
  success: 'border-emerald-500/60 bg-emerald-950/70 text-emerald-100',
  warning: 'border-amber-500/60 bg-amber-950/70 text-amber-100',
  error: 'border-red-500/60 bg-red-950/70 text-red-100',
};

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${typeStyles[toast.type]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-white/80 mt-1">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-xs text-white/60 hover:text-white"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Toast;
