import { NextResponse } from "next/server";
import { ensureInvitationEmailAllowed } from "@/lib/data-store";
import { normalizeGuestEmail, setGuestAuthCookie } from "@/lib/guest-auth";
import { normalizeInviteCode, validateInviteCode } from "@/lib/rsvp";
import { createSupabaseAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
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

    const acceptsDevCode =
      process.env.NODE_ENV !== "production" && normalizedToken === "123456";
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
