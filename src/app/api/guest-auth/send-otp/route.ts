import { NextResponse } from "next/server";
import { ensureInvitationEmailAllowed } from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { normalizeGuestEmail } from "@/lib/guest-auth";
import { normalizeInviteCode, validateInviteCode } from "@/lib/rsvp";
import { createSupabaseAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
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

    if (code && validateInviteCode(code)) {
      await ensureInvitationEmailAllowed(normalizeInviteCode(code), normalizedEmail);
    }

    if (process.env.NODE_ENV !== "production") {
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
    if (error) throw new Error(error.message);

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
