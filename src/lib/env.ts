export function getSiteUrl() {
  // A7: In production, fall back to the canonical URL rather than localhost so
  // that OTP redirect links in emails are never "http://localhost:3000".
  if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production") {
    return "https://rsvp.edwardjessica.com";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function shouldUseSecureCookies() {
  return getSiteUrl().startsWith("https://");
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      getSupabasePublishableKey() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isDemoModeEnabled() {
  // A3: Opt-in rather than opt-out. Development and test (vitest sets NODE_ENV=test)
  // always enable demo mode so local workflows and unit/e2e tests keep working without
  // env churn. Production requires NEXT_PUBLIC_ENABLE_DEMO_MODE=true explicitly.
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return true;
  }
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
}
