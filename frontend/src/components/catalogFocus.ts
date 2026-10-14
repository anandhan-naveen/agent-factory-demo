/** Router state asking the catalog to move focus to the results heading on arrival. */
export interface CatalogLocationState {
  focus?: 'results';
}

export const CATALOG_FOCUS_RESULTS: CatalogLocationState = { focus: 'results' };

export function wantsResultsFocus(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as CatalogLocationState).focus === 'results';
}
