import crypto from "node:crypto";
import { test as base, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_GUEST_AUTH_SECRET } from "./e2e-env";

export { expect } from "@playwright/test";

export const test = base.extend<{ offlineExceptApp: void }>({
  // Default content points at production Supabase storage, Google Maps and
  // other hosts. Abort every request that leaves the e2e server, plus
  // /_next/image calls for remote images (the server would fetch those).
  offlineExceptApp: [
    async ({ context }, use) => {
      const appOrigin = new URL(E2E_BASE_URL).origin;
      await context.route(
        (url) =>
          url.origin !== appOrigin ||
          (url.pathname === "/_next/image" &&
            /^https?:/i.test(url.searchParams.get("url") ?? "")),
        (route) => route.abort(),
      );
      await use();
    },
    { auto: true },
  ],
});

// Same cookie name and format as src/lib/guest-auth.ts.
const GUEST_AUTH_COOKIE = "ej_guest_auth";

function signedGuestSession(email: string) {
  const payload = Buffer.from(
    JSON.stringify({ email, verifiedAt: new Date().toISOString() }),
    "utf8",
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", E2E_GUEST_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

// The production build has no Supabase and no dev OTP bypass, so stand in for
// the email provider: send-otp succeeds, and verify accepts `code` for `email`
// by setting the session cookie the real route would set. Everything after
// verification (resolve-invite, self-register) runs on the real server and
// checks that cookie's signature.
export async function stubEmailOtp(
  page: Page,
  { email, code }: { email: string; code: string },
) {
  await page.route("**/api/guest-auth/send-otp", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/guest-auth/verify", async (route) => {
    const body = route.request().postDataJSON() as {
      email?: string;
      token?: string;
    };
    if (body.email !== email || body.token !== code) {
      await route.fulfill({ status: 400, json: { error: "Invalid code." } });
      return;
    }
    await page.context().addCookies([
      {
        name: GUEST_AUTH_COOKIE,
        value: signedGuestSession(email),
        url: E2E_BASE_URL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await route.fulfill({ json: { email } });
  });
}
