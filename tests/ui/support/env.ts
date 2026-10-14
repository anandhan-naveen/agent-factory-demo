/** Shared by playwright.config.ts and the fixtures. */
const rawRealApi = process.env.E2E_REAL_API?.trim() ?? '';
export const REAL_API_URL: string | undefined = rawRealApi === '' ? undefined : rawRealApi;
export const API_BASE_URL: string = REAL_API_URL ?? 'http://api.test';
export const IS_REAL_API: boolean = REAL_API_URL !== undefined;
