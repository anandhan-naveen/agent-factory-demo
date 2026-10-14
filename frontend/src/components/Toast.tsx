import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/** Polite live region; the region itself is always mounted so screen readers announce changes. */
export function Toast({ toast, onDismiss, durationMs = 4000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [toast, onDismiss, durationMs]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast ? (
        <div className="toast" data-testid="toast" key={toast.id}>
          <svg className="toast__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="toast__text">{toast.text}</span>
          <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
