import { NextResponse } from "next/server";
import {
  ensureInvitationEmailAllowed,
  getPublishedContent,
  submitRsvp,
} from "@/lib/data-store";
import { getGuestAuthSession } from "@/lib/guest-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isRsvpClosed, validateRsvpSubmission } from "@/lib/rsvp";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

export async function POST(request: Request) {
  // D4: rate-limit unauthenticated-adjacent endpoint (best-effort, per-instance on serverless)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`rsvp:${ip}`, 10, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const content = await getPublishedContent();
    if (isRsvpClosed(content.rsvpDeadline)) {
      return NextResponse.json({ error: "RSVP editing is closed." }, { status: 403 });
    }

    const payload = validateRsvpSubmission(await request.json());
    const guestAuth = await getGuestAuthSession();
    if (!guestAuth?.email) {
      return NextResponse.json(
        { error: "Please verify your email before submitting RSVP." },
        { status: 401 },
      );
    }
    await ensureInvitationEmailAllowed(payload.code, guestAuth.email, {
      claimIfEmpty: true,
    });
    const invitation = await submitRsvp(payload, "guest");

    // D1: email runs AFTER the successful save and can never throw past itself.
    // emailStatus is included in the response so the client can notify the guest.
    const emailResult = await sendRsvpConfirmationEmail({ content, invitation }).catch(
      (err) => {
        console.error(
          `[rsvp] Unexpected error sending confirmation email for ${invitation.code}:`,
          err,
        );
        return { status: "failed" as const, reason: String(err) };
      },
    );
    if (emailResult.status !== "sent") {
      console.error(
        `[rsvp] Email ${emailResult.status} for invitation ${invitation.code}:`,
        (emailResult as { reason?: string }).reason ?? "",
      );
    }

    // E1-7: strip PII fields before returning the invitation to the client so a
    // re-render of EmailOtpGate cannot pre-fill the email input from API data.
    const { email: _email, phone: _phone, privateNotes: _notes, ...safeInvitation } = invitation;
    return NextResponse.json({
      invitation: { ...safeInvitation, emailClaimed: Boolean(invitation.email) },
      emailStatus: emailResult.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit RSVP." },
      { status: 400 },
    );
  }
}
