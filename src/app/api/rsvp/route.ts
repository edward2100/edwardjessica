import { NextResponse } from "next/server";
import {
  ensureInvitationEmailAllowed,
  getPublishedContent,
  submitRsvp,
} from "@/lib/data-store";
import { getGuestAuthSession } from "@/lib/guest-auth";
import { isRsvpClosed, validateRsvpSubmission } from "@/lib/rsvp";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

export async function POST(request: Request) {
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
    await sendRsvpConfirmationEmail({ content, invitation });
    return NextResponse.json({ invitation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit RSVP." },
      { status: 400 }
    );
  }
}
