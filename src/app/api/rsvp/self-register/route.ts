import { NextResponse } from "next/server";
import {
  createSelfRegisteredInvitation,
  getInvitationByVerifiedEmail,
  getPublishedContent,
} from "@/lib/data-store";
import { getGuestAuthSession } from "@/lib/guest-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isRsvpClosed, validateSelfRegistration, validateSelfRegistrationForInviteType } from "@/lib/rsvp";
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

    const guestAuth = await getGuestAuthSession();
    if (!guestAuth?.email) {
      return NextResponse.json(
        { error: "Please verify your email before submitting RSVP." },
        { status: 401 },
      );
    }
    const payload = validateSelfRegistration({
      ...(await request.json()),
      email: guestAuth.email,
    });
    const inviteType = validateSelfRegistrationForInviteType(payload, content);
    const existingInvitation = await getInvitationByVerifiedEmail(guestAuth.email);
    if (existingInvitation) {
      // Already registered — no email send needed; emailStatus skipped for idempotent path.
      // E1-7: strip PII before returning.
      const { email: _email, phone: _phone, privateNotes: _notes, ...safeExisting } = existingInvitation;
      return NextResponse.json({
        invitation: safeExisting,
        existing: true,
        emailStatus: "skipped",
      });
    }

    const invitation = await createSelfRegisteredInvitation(payload, inviteType);

    // D1: email runs AFTER the successful save and can never throw past itself.
    // emailStatus is included in the response so the client can notify the guest.
    const emailResult = await sendRsvpConfirmationEmail({ content, invitation }).catch(
      (err) => {
        console.error(
          `[self-register] Unexpected error sending confirmation email for ${invitation.code}:`,
          err,
        );
        return { status: "failed" as const, reason: String(err) };
      },
    );
    if (emailResult.status !== "sent") {
      console.error(
        `[self-register] Email ${emailResult.status} for invitation ${invitation.code}:`,
        (emailResult as { reason?: string }).reason ?? "",
      );
    }

    // E1-7: strip PII fields before returning the invitation to the client so a
    // re-render of EmailOtpGate cannot pre-fill the email input from API data.
    const { email: _email, phone: _phone, privateNotes: _notes, ...safeInvitation } = invitation;
    return NextResponse.json({ invitation: safeInvitation, existing: false, emailStatus: emailResult.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register RSVP." },
      { status: 400 },
    );
  }
}
