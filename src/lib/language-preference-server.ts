import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, parseLanguage } from "@/lib/language-preference";

/**
 * The guest's saved language (ej_language cookie), passed to guest pages as
 * `initialLanguage` so the server renders what the client hydrates with.
 */
export async function getLanguagePreference() {
  const cookieStore = await cookies();
  return parseLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);
}
