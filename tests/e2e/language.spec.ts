import type { Page } from "@playwright/test";
import { copy } from "@/lib/i18n";
import { E2E_BASE_URL } from "./e2e-env";
import { expect, test } from "./fixtures";

// The guest's language choice lives in localStorage and the ej_language
// cookie. The server renders the cookie's language, so a saved Indonesian
// choice must not cause a hydration mismatch (server English, client
// Indonesian) on any guest page.

const GUEST_PAGES = [
  "/",
  "/jessmarried",
  "/invite/EJ26-HARDWIN",
  "/travel-accommodation",
  "/discover-medan",
];

function activeLanguage(page: Page) {
  return page.locator(".language-switch button.active").first();
}

async function saveLanguageCookie(page: Page, language: "en" | "id") {
  await page
    .context()
    .addCookies([{ name: "ej_language", value: language, url: E2E_BASE_URL }]);
}

function saveLanguageInStorage(page: Page, language: "en" | "id") {
  return page.addInitScript(
    (value) => window.localStorage.setItem("ej_language", value),
    language,
  );
}

// Production builds report hydration mismatches as React errors #418/#423/#425.
function collectHydrationErrors(page: Page) {
  const errors: string[] = [];
  const record = (message: string) => {
    if (/hydrat|Minified React error #(418|423|425)/i.test(message)) {
      errors.push(message);
    }
  };
  page.on("pageerror", (error) => record(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") record(message.text());
  });
  return errors;
}

test.describe("server HTML", () => {
  test.use({ javaScriptEnabled: false });

  test("guest pages render the language saved in the cookie", async ({ page }) => {
    await saveLanguageCookie(page, "id");
    for (const path of GUEST_PAGES) {
      await page.goto(path);
      await expect(activeLanguage(page), path).toHaveText("ID");
    }
    await page.goto("/");
    await expect(
      page.getByText(copy.id.genericInviteGreeting, { exact: true }),
    ).toBeVisible();
  });
});

test("a returning Indonesian guest hydrates every guest page without a mismatch", async ({
  page,
}) => {
  await saveLanguageCookie(page, "id");
  await saveLanguageInStorage(page, "id");
  const hydrationErrors = collectHydrationErrors(page);
  for (const path of GUEST_PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(activeLanguage(page), path).toHaveText("ID");
  }
  expect(hydrationErrors).toEqual([]);
});

test("a choice saved before the cookie existed switches after load and is kept", async ({
  page,
}) => {
  await saveLanguageInStorage(page, "id");
  const hydrationErrors = collectHydrationErrors(page);
  await page.goto("/jessmarried", { waitUntil: "networkidle" });
  await expect(
    page.getByText(copy.id.genericInviteGreeting, { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find(
          (cookie) => cookie.name === "ej_language",
        )?.value,
    )
    .toBe("id");
  expect(hydrationErrors).toEqual([]);
});
