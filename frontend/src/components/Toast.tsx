import { useEffect } from 'react';

export type ToastKind = 'success' | 'error';

export interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Success messages go into an always-mounted polite status region; errors into a role="alert"
 * element. Only the message text is inside the live region: the dismiss button stays outside.
 */
export function Toast({ toast, onDismiss, durationMs = 4000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [toast, onDismiss, durationMs]);

  const kind = toast?.kind ?? 'success';

  return (
    <div className="toast-region">
      <div
        className={toast ? `toast toast--${kind}` : 'toast toast--idle'}
        data-testid={toast ? 'toast' : undefined}
        data-kind={toast ? kind : undefined}
      >
        {toast ? (
          <svg className="toast__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            {kind === 'error' ? (
              <path d="M10 5v6M10 14.5v.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            ) : (
              <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        ) : null}
        <div className="toast__text">
          <span role="status" aria-live="polite">
            {toast?.kind === 'success' ? toast.text : null}
          </span>
          {/* role="alert" is announced when inserted, so it only exists while an error is shown. */}
          {toast?.kind === 'error' ? <span role="alert">{toast.text}</span> : null}
        </div>
        {toast ? (
          <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss notification">
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
