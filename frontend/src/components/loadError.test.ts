import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeLoadError, LOAD_ERROR_COPY } from './loadError';

describe('describeLoadError (D10)', () => {
  it('maps a 400 on q to search copy, caused by filters', () => {
    expect(describeLoadError(new ApiError(400, 'Validation failed', { q: 'Search must be 200 characters or fewer' }), true)).toEqual({
      message: LOAD_ERROR_COPY.search,
      filtersCause: true,
    });
  });

  // R3-FE-03: the panel only shows page-0 failures, so "loading more" copy would be wrong there.
  it.each(['page', 'size'])('maps a 400 on %s to generic copy, not caused by filters', (field) => {
    for (const filtersActive of [true, false]) {
      expect(describeLoadError(new ApiError(400, 'Validation failed', { [field]: 'bad' }), filtersActive)).toEqual({
        message: LOAD_ERROR_COPY.generic,
        filtersCause: false,
      });
    }
  });

  it('maps any other 400 to filters copy while filters are active', () => {
    expect(describeLoadError(new ApiError(400, 'Validation failed', { genre: 'bad' }), true)).toEqual({
      message: LOAD_ERROR_COPY.filters,
      filtersCause: true,
    });
    expect(describeLoadError(new ApiError(400, 'Validation failed'), true).message).toBe(LOAD_ERROR_COPY.filters);
  });

  // R3-FE-03: with no active filters there is nothing to clear (the button is hidden), so don't say so.
  it('uses generic copy for a filter-caused 400 when no filters are active', () => {
    const cases: Record<string, string>[] = [{ genre: 'bad' }, { q: 'bad' }, {}];
    for (const errors of cases) {
      expect(describeLoadError(new ApiError(400, 'Validation failed', errors), false)).toEqual({
        message: LOAD_ERROR_COPY.generic,
        filtersCause: false,
      });
    }
  });

  it('uses network copy for status 0 and generic copy for 5xx and unknown errors', () => {
    expect(describeLoadError(new ApiError(0, 'Network error'), false).message).toBe(LOAD_ERROR_COPY.network);
    expect(describeLoadError(new ApiError(503, 'Service Unavailable'), true).message).toBe(LOAD_ERROR_COPY.generic);
    expect(describeLoadError(new Error('boom'), false).message).toBe(LOAD_ERROR_COPY.generic);
    expect(describeLoadError('weird', true).filtersCause).toBe(false);
  });

  it('never returns the raw problem title', () => {
    for (const status of [0, 400, 404, 500]) {
      for (const filtersActive of [true, false]) {
        expect(describeLoadError(new ApiError(status, 'Validation failed'), filtersActive).message).not.toContain('Validation failed');
      }
    }
  });
});
