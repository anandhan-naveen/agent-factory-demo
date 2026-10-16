import { useEffect, useLayoutEffect, useRef } from 'react';
import { keepFocusClearOfToast, releaseToastSpace, reserveToastSpace } from './toastClearance';

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
 *
 * While a toast is visible it reserves its height at the bottom of the page (padding and
 * scroll-padding via --toast-space) and scrolls the focused control clear of it, so the toast
 * never hides keyboard focus or the badge that just changed (WCAG 2.4.11).
 */
export function Toast({ toast, onDismiss, durationMs = 4000 }: Readonly<Props>) {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [toast, onDismiss, durationMs]);

  /** Cancels a release still waiting for the user to scroll out of the reserved space (R3-FE-02). */
  const cancelRelease = useRef<(force?: boolean) => void>(() => undefined);

  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!toast || !region) return;
    cancelRelease.current();
    let space = reserveToastSpace(region);
    keepFocusClearOfToast(region, document.activeElement);

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element) keepFocusClearOfToast(region, event.target);
    };
    // R3-FE-01: the toast's height changes with the viewport (wrapping, orientation), so re-measure.
    const remeasure = () => {
      space = reserveToastSpace(region);
      keepFocusClearOfToast(region, document.activeElement);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(remeasure) : null;
    observer?.observe(region);
    window.addEventListener('resize', remeasure);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('resize', remeasure);
      observer?.disconnect();
      cancelRelease.current = releaseToastSpace(space);
    };
  }, [toast]);

  // On unmount, drop any space still kept for a scrolled-to-bottom page.
  useEffect(
    () => () => {
      cancelRelease.current(true);
    },
    [],
  );

  const kind = toast?.kind ?? 'success';

  return (
    <div className="toast-region" ref={regionRef}>
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
