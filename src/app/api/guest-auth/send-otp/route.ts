import { NextResponse } from "next/server";
import { ensureInvitationEmailAllowed } from "@/lib/data-store";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { normalizeGuestEmail } from "@/lib/guest-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeInviteCode, validateInviteCode } from "@/lib/rsvp";
import { createSupabaseAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
  // A5: Rate-limit OTP sends — per-IP and per-email
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipCheck = checkRateLimit(`otp:${ip}`, 10, 10 * 60 * 1000);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { email, code } = (await request.json()) as {
      email?: string;
      code?: string;
    };
    const normalizedEmail = normalizeGuestEmail(email || "");
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    // A5: Also rate-limit per email address
    const emailCheck = checkRateLimit(
      `otp-email:${normalizedEmail}`,
      5,
      10 * 60 * 1000,
    );
    if (!emailCheck.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    if (code && validateInviteCode(code)) {
      await ensureInvitationEmailAllowed(normalizeInviteCode(code), normalizedEmail);
    }

    if (process.env.NODE_ENV !== "production" && !isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, devCode: "123456" });
    }

    const supabase = createSupabaseAuthClient();
    if (!supabase) throw new Error("Supabase Auth is not configured.");
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getSiteUrl(),
        shouldCreateUser: true,
      },
    });
    // A6: Do not distinguish "email not found" from other errors — return the
    // same success-shaped response to prevent account enumeration. Log the real
    // error server-side for debugging.
    if (error) {
      console.error("[send-otp] Supabase OTP error for", normalizedEmail, error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send email code.",
      },
      { status: 400 },
    );
  }
}
