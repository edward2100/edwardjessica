import { defineConfig, devices } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_GUEST_AUTH_SECRET,
  E2E_PORT,
} from "./tests/e2e/e2e-env";

const LATE_RSVP_SPEC = /late-rsvp\.spec\.ts$/;
const SIMPLE_RSVP_SPEC = /simple-rsvp\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry"
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    // Hermetic demo-mode production build. Next never lets a .env* file
    // override a variable that is already set, so these blanks win over any
    // .env.local: no Supabase (in-memory preview store) and no Resend email.
    env: {
      NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
      NEXT_PUBLIC_ENABLE_DEMO_MODE: "true",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      RESEND_API_KEY: "",
      GUEST_AUTH_SECRET: E2E_GUEST_AUTH_SECRET
    }
  },
  projects: [
    { name: "setup", testMatch: /\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: [LATE_RSVP_SPEC, SIMPLE_RSVP_SPEC]
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
      dependencies: ["setup"],
      testIgnore: [LATE_RSVP_SPEC, SIMPLE_RSVP_SPEC]
    },
    // LR-5: publishes a deadline in the past, which every other spec on the
    // shared in-memory server would see, so it runs alone after both browser
    // projects (and restores the open deadline).
    {
      name: "late-rsvp",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium", "mobile"],
      testMatch: LATE_RSVP_SPEC
    },
    // SF-7: publishes a simple link at /JESSmarriED, which every page would
    // see, so it also runs alone, after late-rsvp (and restores the content).
    {
      name: "simple-rsvp",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["late-rsvp"],
      testMatch: SIMPLE_RSVP_SPEC
    }
  ]
});
