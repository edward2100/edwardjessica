// Test-only values shared by playwright.config.ts (webServer env) and the
// specs. Kept free of Playwright imports so the config can load it.

export const E2E_PORT = 3010;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

// Production builds refuse to sign guest-auth cookies without a secret. This
// one only ever signs cookies for the throwaway e2e server.
export const E2E_GUEST_AUTH_SECRET = "e2e-only-guest-auth-secret";

// Published by the setup project so RSVP is open whatever the real clock says.
export const E2E_OPEN_RSVP_DEADLINE = "2099-12-31T16:59:59.000Z";

// Demo-mode admin from src/lib/seed.ts (any password works in preview mode).
export const E2E_ADMIN = { email: "edward@example.com", password: "preview" };
