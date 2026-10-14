import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

describe('Toast', () => {
  it('renders an always-present polite status region', () => {
    render(<Toast toast={null} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('auto-dismisses after the duration', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast toast={{ id: 1, text: 'Book added' }} onDismiss={onDismiss} durationMs={1000} />);
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
    render(<Toast toast={{ id: 2, text: 'Saved' }} onDismiss={onDismiss} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
