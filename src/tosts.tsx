import { useEffect } from 'react';
import './tosts.css';

export type ToastType = 'success' | 'error';

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastsProps = {
  toasts: ToastItem[];
  onClose: (id: number) => void;
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onClose(toast.id);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
      <span className="toast__message">{toast.message}</span>
      <button
        type="button"
        className="toast__close"
        onClick={() => onClose(toast.id)}
        aria-label="Закрыть уведомление"
      >
        ×
      </button>
    </div>
  );
}

export function Toasts({ toasts, onClose }: ToastsProps) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
