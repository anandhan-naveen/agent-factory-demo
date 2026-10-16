import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rect } from '../test/geometry';
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

  it('D9: reserves bottom space while a toast is shown and releases it after', () => {
    const { rerender } = render(<Toast toast={{ id: 5, text: 'Saved', kind: 'success' }} onDismiss={vi.fn()} />);
    const root = document.documentElement;
    expect(root).toHaveClass('has-toast');
    expect(root.style.getPropertyValue('--toast-space')).toMatch(/^\d+px$/);
    rerender(<Toast toast={null} onDismiss={vi.fn()} />);
    expect(root).not.toHaveClass('has-toast');
    expect(root.style.getPropertyValue('--toast-space')).toBe('');
  });

  it('D9: scrolls a control focused while the toast is shown clear of it', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const button = document.createElement('button');
    document.body.append(button);
    try {
      const { container } = render(<Toast toast={{ id: 6, text: 'Saved', kind: 'success' }} onDismiss={vi.fn()} />);
      const region = container.querySelector('.toast-region');
      if (!(region instanceof HTMLElement)) throw new Error('no region');
      vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(rect(688, 756));
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(710, 750));
      act(() => {
        button.focus();
      });
      expect(scrollBy).toHaveBeenCalledWith({ top: 74, behavior: 'smooth' });
    } finally {
      button.remove();
    }
  });

  // R3-FE-01: the reserved space was measured once; a resize/orientation change could leave focus under the toast.
  describe('re-measures on resize (R3-FE-01)', () => {
    let observed: { callback: ResizeObserverCallback; targets: Element[]; disconnected: boolean } | null = null;

    beforeEach(() => {
      observed = null;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: ResizeObserverCallback) {
            observed = { callback, targets: [], disconnected: false };
          }
          observe(target: Element) {
            observed?.targets.push(target);
          }
          unobserve() {
            /* not used */
          }
          disconnect() {
            if (observed) observed.disconnected = true;
          }
        },
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function setup() {
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
      const button = document.createElement('button');
      document.body.append(button);
      button.focus();
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(600, 640));
      const utils = render(<Toast toast={{ id: 7, text: 'Saved', kind: 'success' }} onDismiss={vi.fn()} />);
      const region = utils.container.querySelector('.toast-region');
      if (!(region instanceof HTMLElement)) throw new Error('no region');
      return { ...utils, region, button, scrollBy };
    }

    it('recomputes --toast-space and keeps focus clear when the toast region resizes', () => {
      const { region, button, scrollBy, unmount } = setup();
      try {
        expect(observed?.targets).toEqual([region]);
        expect(scrollBy).not.toHaveBeenCalled();
        // Toast grows (text wraps after a rotation) and now covers the focused button.
        vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(rect(window.innerHeight - 200, window.innerHeight - 24));
        vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(window.innerHeight - 150, window.innerHeight - 110));
        act(() => {
          observed?.callback([], {} as ResizeObserver);
        });
        expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('212px');
        expect(scrollBy).toHaveBeenCalledWith({ top: 102, behavior: 'smooth' });
        unmount();
        expect(observed?.disconnected).toBe(true);
      } finally {
        button.remove();
      }
    });

    it('recomputes on window resize and stops listening once the toast closes', () => {
      const { region, button, rerender } = setup();
      try {
        vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(rect(window.innerHeight - 100, window.innerHeight - 24));
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('112px');

        rerender(<Toast toast={null} onDismiss={vi.fn()} />);
        expect(observed?.disconnected).toBe(true);
        expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('');
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('');
      } finally {
        button.remove();
      }
    });
  });
});
