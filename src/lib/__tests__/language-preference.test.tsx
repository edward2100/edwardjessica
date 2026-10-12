import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStoredLanguage,
  parseLanguage,
  storeLanguage,
} from "@/lib/language-preference";
import type { Language } from "@/lib/types";
import { useGuestLanguage } from "@/lib/use-guest-language";

// Guest pages render the ej_language cookie on the server and hydrate with
// the same value, so a saved Indonesian choice no longer causes a hydration
// mismatch (server English vs client Indonesian).

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let container: HTMLDivElement;
let root: Root | null;

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

function clearLanguageCookie() {
  document.cookie = "ej_language=; Path=/; Max-Age=0";
}

function LanguageProbe({
  initialLanguage,
}: {
  initialLanguage?: Language | null;
}) {
  const [language, setLanguage] = useGuestLanguage(initialLanguage, "en");
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "en" ? "id" : "en")}
    >
      {language}
    </button>
  );
}

// Server HTML first (the server cannot see localStorage), then the browser's
// saved choice, then hydration.
function serverRenderThenHydrate(
  initialLanguage: Language | null,
  savedLanguage: Language | null,
) {
  const element = <LanguageProbe initialLanguage={initialLanguage} />;
  container.innerHTML = renderToString(element);
  const serverText = container.textContent;
  if (savedLanguage) window.localStorage.setItem("ej_language", savedLanguage);
  const recoverableErrors: unknown[] = [];
  act(() => {
    root = hydrateRoot(container, element, {
      onRecoverableError: (error) => recoverableErrors.push(error),
    });
  });
  return { serverText, recoverableErrors };
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("localStorage", memoryStorage());
  clearLanguageCookie();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = null;
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  clearLanguageCookie();
  vi.unstubAllGlobals();
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

describe("language preference storage", () => {
  it("accepts only supported languages", () => {
    expect(parseLanguage("en")).toBe("en");
    expect(parseLanguage("id")).toBe("id");
    expect(parseLanguage("fr")).toBeNull();
    expect(parseLanguage(undefined)).toBeNull();
  });

  it("stores the choice in localStorage and the ej_language cookie", () => {
    storeLanguage("id");
    expect(window.localStorage.getItem("ej_language")).toBe("id");
    expect(document.cookie).toContain("ej_language=id");
  });

  it("falls back to the cookie when localStorage has no choice", () => {
    storeLanguage("id");
    window.localStorage.clear();
    expect(getStoredLanguage()).toBe("id");
  });
});

describe("useGuestLanguage hydration", () => {
  it("hydrates with the cookie language without a mismatch", () => {
    storeLanguage("id");
    const { serverText, recoverableErrors } = serverRenderThenHydrate(
      "id",
      "id",
    );
    expect(serverText).toBe("id");
    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe("id");
  });

  it("switches a localStorage-only choice after hydration and saves the cookie", () => {
    const { serverText, recoverableErrors } = serverRenderThenHydrate(
      null,
      "id",
    );
    expect(serverText).toBe("en");
    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe("id");
    expect(document.cookie).toContain("ej_language=id");
  });

  it("keeps the default language when nothing is saved", () => {
    const { serverText, recoverableErrors } = serverRenderThenHydrate(
      null,
      null,
    );
    expect(serverText).toBe("en");
    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe("en");
    expect(document.cookie).not.toContain("ej_language=");
  });

  it("persists a toggle", () => {
    serverRenderThenHydrate(null, null);
    act(() => {
      container.querySelector("button")?.click();
    });
    expect(container.textContent).toBe("id");
    expect(window.localStorage.getItem("ej_language")).toBe("id");
    expect(document.cookie).toContain("ej_language=id");
  });
});
