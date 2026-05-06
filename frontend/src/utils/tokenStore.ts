// In-memory access token storage — never written to localStorage/sessionStorage.
// Cleared on page refresh; restored via /auth/refresh (httpOnly cookie).
let _token: string | null = null;

export const getToken = (): string | null => _token;
export const setToken = (t: string | null): void => { _token = t; };
