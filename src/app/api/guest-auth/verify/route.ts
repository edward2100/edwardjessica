import { NextResponse } from "next/server";
import { ensureInvitationEmailAllowed } from "@/lib/data-store";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizeGuestEmail, setGuestAuthCookie } from "@/lib/guest-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeInviteCode, validateInviteCode } from "@/lib/rsvp";
import { createSupabaseAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
  // A5: Rate-limit OTP verification attempts per IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipCheck = checkRateLimit(`verify:${ip}`, 15, 10 * 60 * 1000);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { email, token, code } = (await request.json()) as {
      email?: string;
      token?: string;
      code?: string;
    };
    const normalizedEmail = normalizeGuestEmail(email || "");
    const normalizedToken = String(token || "").trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    if (!normalizedToken) {
      return NextResponse.json(
        { error: "Please enter the email code." },
        { status: 400 },
      );
    }

    // A4: The dev bypass code is only accepted in non-production environments
    // AND when Supabase is not configured (i.e. true demo/preview mode).
    const acceptsDevCode =
      process.env.NODE_ENV !== "production" &&
      !isSupabaseConfigured() &&
      normalizedToken === "123456";
    if (!acceptsDevCode) {
      const supabase = createSupabaseAuthClient();
      if (!supabase) throw new Error("Supabase Auth is not configured.");
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: "email",
      });
      if (error) throw new Error(error.message);
    }

    if (code && validateInviteCode(code)) {
      await ensureInvitationEmailAllowed(normalizeInviteCode(code), normalizedEmail, {
        claimIfEmpty: true,
      });
    }

    await setGuestAuthCookie(normalizedEmail);
    return NextResponse.json({ email: normalizedEmail });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify email code.",
      },
      { status: 400 },
    );
  }
}
