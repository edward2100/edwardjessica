import crypto from "node:crypto";
import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/env";

export const GUEST_AUTH_COOKIE = "ej_guest_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

export type GuestAuthSession = {
  email: string;
  verifiedAt: string;
};

function signingSecret() {
  // A1: Never use a public/client-side env var for the HMAC key.
  // Order: dedicated secret > service-role key (server-only, acceptable).
  // The hardcoded local fallback is ONLY allowed outside production so local
  // development works without env setup. In production both secrets being absent
  // is a misconfiguration — throw rather than silently using a guessable key.
  if (process.env.GUEST_AUTH_SECRET) return process.env.GUEST_AUTH_SECRET;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV === "production") {
    throw new Error("GUEST_AUTH_SECRET is not configured");
  }
  return "edward-jessica-local-guest-auth";
}

export function normalizeGuestEmail(email: string) {
  return email.trim().toLowerCase();
}

function signPayload(payload: string) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
}

function encodeSession(session: GuestAuthSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${payload}.${signPayload(payload)}`;
}

function decodeSession(value: string | undefined): GuestAuthSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expectedSignature = signPayload(payload);
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as GuestAuthSession;
    if (!parsed.email || !parsed.verifiedAt) return null;
    // A2: Enforce server-side session expiry — reject sessions older than
    // COOKIE_MAX_AGE_SECONDS (60 days) even if the cookie was somehow kept longer.
    const verifiedAt = new Date(parsed.verifiedAt).getTime();
    if (isNaN(verifiedAt)) return null;
    const ageSeconds = (Date.now() - verifiedAt) / 1000;
    if (ageSeconds > COOKIE_MAX_AGE_SECONDS) return null;
    return {
      email: normalizeGuestEmail(parsed.email),
      verifiedAt: parsed.verifiedAt,
    };
  } catch {
    return null;
  }
}

export async function setGuestAuthCookie(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    GUEST_AUTH_COOKIE,
    encodeSession({
      email: normalizeGuestEmail(email),
      verifiedAt: new Date().toISOString(),
    }),
    {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
    },
  );
}

export async function getGuestAuthSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(GUEST_AUTH_COOKIE)?.value);
}
