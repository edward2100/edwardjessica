export type GuestLanguage = "en" | "id";

const LANGUAGE_STORAGE_KEY = "ej_language";
// The cookie mirrors localStorage so the server can render the guest's
// language (no hydration mismatch, no flash of the default language).
export const LANGUAGE_COOKIE = "ej_language";
const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

export function parseLanguage(value: unknown): GuestLanguage | null {
  return value === "en" || value === "id" ? value : null;
}

function readLanguageCookie() {
  const prefix = `${LANGUAGE_COOKIE}=`;
  try {
    const entry = document.cookie
      .split("; ")
      .find((part) => part.startsWith(prefix));
    return parseLanguage(entry?.slice(prefix.length));
  } catch {
    // Cookies can be blocked (sandboxed frames); read during render, so never throw.
    return null;
  }
}

export function getStoredLanguage(): GuestLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const value = parseLanguage(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
    if (value) return value;
  } catch {
    // Storage can be unavailable (private mode); fall back to the cookie.
  }
  return readLanguageCookie();
}

export function storeLanguage(language: GuestLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode); the cookie still persists it.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Cookies can be blocked; the choice then only lasts in localStorage.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeToLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
