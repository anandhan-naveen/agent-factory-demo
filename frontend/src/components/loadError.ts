import { ApiError } from '../api/client';

/** HTTP status the catalog API returns for request validation failures. */
const HTTP_BAD_REQUEST = 400;
/** Status the API client reports when the request never got a response (network failure). */
const NETWORK_FAILURE_STATUS = 0;

export interface LoadErrorCopy {
  /** Plain-language explanation shown under "We couldn't load the catalog." */
  message: string;
  /** True when the current filters caused the failure, so clearing them is the way out. */
  filtersCause: boolean;
}

export const LOAD_ERROR_COPY = {
  search: 'Your search is too long. Shorten it and try again.',
  filters: 'Some filters aren’t valid. Clear the filters and try again.',
  network: 'We couldn’t reach the catalog service. Check your connection and try again.',
  generic: 'Something went wrong on our side. Try again in a moment.',
} as const;

const GENERIC: LoadErrorCopy = { message: LOAD_ERROR_COPY.generic, filtersCause: false };

/**
 * Maps a catalog load failure to librarian-facing copy. The raw problem title
 * (e.g. "Validation failed") is never shown.
 *
 * The error panel only ever shows page-0 failures ("load more" failures go to a toast), so a 400 on
 * page/size gets the generic copy. Copy that points at the filters is used only when filters are
 * actually active; otherwise there is nothing to clear and the generic copy is shown.
 */
export function describeLoadError(error: unknown, filtersActive: boolean): LoadErrorCopy {
  if (error instanceof ApiError) {
    if (error.status === HTTP_BAD_REQUEST) {
      if ('page' in error.errors || 'size' in error.errors) return GENERIC;
      if (!filtersActive) return GENERIC;
      return { message: 'q' in error.errors ? LOAD_ERROR_COPY.search : LOAD_ERROR_COPY.filters, filtersCause: true };
    }
    if (error.status === NETWORK_FAILURE_STATUS) return { message: LOAD_ERROR_COPY.network, filtersCause: false };
  }
  return GENERIC;
}
