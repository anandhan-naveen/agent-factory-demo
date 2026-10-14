interface Props {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: Readonly<Props>) {
  return (
    <div className="state state--error" role="alert" data-testid="error-state">
      <p className="state__title">We couldn’t load the catalog.</p>
      <p className="state__detail">{message}</p>
      <button type="button" className="button button--primary" onClick={onRetry} data-testid="retry-button">
        Try again
      </button>
    </div>
  );
}
