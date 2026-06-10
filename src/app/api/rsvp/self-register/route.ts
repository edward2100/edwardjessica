import { NextResponse } from "next/server";
import {
  createSelfRegisteredInvitation,
  getInvitationByVerifiedEmail,
  getPublishedContent,
} from "@/lib/data-store";
import { getGuestAuthSession } from "@/lib/guest-auth";
import { isRsvpClosed, validateSelfRegistration, validateSelfRegistrationForInviteType } from "@/lib/rsvp";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

export async function POST(request: Request) {
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
      return NextResponse.json({
        invitation: existingInvitation,
        existing: true,
      });
    }

    const invitation = await createSelfRegisteredInvitation(payload, inviteType);
    await sendRsvpConfirmationEmail({ content, invitation });
    return NextResponse.json({ invitation, existing: false });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register RSVP." },
      { status: 400 }
    );
  }
}
