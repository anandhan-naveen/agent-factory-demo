import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

describe('Toast', () => {
  it('renders an always-present polite status region', () => {
    render(<Toast toast={null} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the duration', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast toast={{ id: 1, text: 'Book added', kind: 'success' }} onDismiss={onDismiss} durationMs={1000} />);
      expect(screen.getByRole('status')).toHaveTextContent('Book added');
      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be dismissed with the close button', async () => {
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: 2, text: 'Saved', kind: 'success' }} onDismiss={onDismiss} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('R-FE-09: keeps the dismiss button outside the live region', () => {
    render(<Toast toast={{ id: 3, text: 'Saved', kind: 'success' }} onDismiss={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^Saved$/);
    expect(status).not.toContainElement(screen.getByRole('button', { name: 'Dismiss notification' }));
  });

  it('R-FE-09: shows errors as an alert with error styling', () => {
    render(<Toast toast={{ id: 4, text: 'Couldn’t update', kind: 'error' }} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Couldn’t update$/);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByTestId('toast')).toHaveClass('toast--error');
    expect(screen.getByRole('alert')).not.toContainElement(screen.getByRole('button', { name: 'Dismiss notification' }));
  });
});
