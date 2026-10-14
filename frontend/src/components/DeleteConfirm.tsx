import { useEffect, useRef, type KeyboardEvent } from 'react';

interface Props {
  title: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inline confirmation shown in place of the row actions (no browser dialogs). */
export function DeleteConfirm({ title, busy, onConfirm, onCancel }: Readonly<Props>) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'Escape' && !busy) onCancel();
  }

  return (
    <div className="confirm" role="group" aria-label={`Confirm deleting ${title}`}>
      <p className="confirm__text">Delete this book? This can’t be undone.</p>
      <div className="confirm__actions">
        <button type="button" className="button button--danger" onClick={() => {
            if (!busy) onConfirm();
          }}
          aria-disabled={busy} onKeyDown={handleKeyDown} data-testid="confirm-delete">
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" className="button button--ghost" onClick={() => {
            if (!busy) onCancel();
          }}
          aria-disabled={busy} onKeyDown={handleKeyDown} ref={cancelRef} data-testid="cancel-delete">
          Cancel
        </button>
      </div>
    </div>
  );
}
