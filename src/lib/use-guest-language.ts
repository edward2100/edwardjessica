import { useEffect, useSyncExternalStore } from "react";
import {
  getStoredLanguage,
  storeLanguage,
  subscribeToLanguage,
} from "@/lib/language-preference";
import type { Language } from "@/lib/types";

const noStoredLanguageOnServer = () => null;

/**
 * The guest's language and a setter that persists it. The server render and
 * hydration both use `initialLanguage` (the ej_language cookie, read by the
 * route) or the content default, so the markup matches; the stored choice
 * takes over after hydration. A choice saved only in localStorage (before the
 * cookie existed) switches once after load and is copied into the cookie, so
 * the next load renders in that language on the server.
 */
export function useGuestLanguage(
  initialLanguage: Language | null | undefined,
  defaultLanguage: Language,
) {
  const storedLanguage = useSyncExternalStore(
    subscribeToLanguage,
    getStoredLanguage,
    noStoredLanguageOnServer,
  );
  const language = storedLanguage ?? initialLanguage ?? defaultLanguage;

  useEffect(() => {
    if (storedLanguage && storedLanguage !== initialLanguage) {
      storeLanguage(storedLanguage);
    }
  }, [initialLanguage, storedLanguage]);

  return [language, storeLanguage] as const;
}
