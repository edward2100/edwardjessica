export type GuestLanguage = "en" | "id";

const LANGUAGE_STORAGE_KEY = "ej_language";

export function getStoredLanguage(): GuestLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return value === "en" || value === "id" ? value : null;
  } catch {
    return null;
  }
}

export function storeLanguage(language: GuestLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode); language simply won't persist.
  }
}
