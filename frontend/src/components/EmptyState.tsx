import type { ReactNode } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: Readonly<Props>) {
  return (
    <div className="state state--empty" data-testid="empty-state">
      <svg className="state__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M8 10h12a6 6 0 0 1 6 6v24a4 4 0 0 0-4-4H8z M40 10H28a6 6 0 0 0-6 6v24a4 4 0 0 1 4-4h14z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <p className="state__title">{title}</p>
      {children}
    </div>
  );
}
