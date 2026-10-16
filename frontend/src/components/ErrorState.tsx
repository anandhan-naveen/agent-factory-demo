interface Props {
  message: string;
  onRetry: () => void;
  /** When set, a "Clear filters" button is offered next to "Try again". */
  onClearFilters?: () => void;
}

export function ErrorState({ message, onRetry, onClearFilters }: Readonly<Props>) {
  return (
    <div className="state state--error" role="alert" data-testid="error-state">
      <p className="state__title">We couldn’t load the catalog.</p>
      <p className="state__detail">{message}</p>
      <div className="state__actions">
        <button type="button" className="button button--primary" onClick={onRetry} data-testid="retry-button">
          Try again
        </button>
        {onClearFilters ? (
          <button type="button" className="button button--secondary" onClick={onClearFilters} data-testid="clear-filters">
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
