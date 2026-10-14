import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getInvitationByCode, getPublishedContent } from "@/lib/data-store";
import { normalizeContactEmail, normalizeInviteCode } from "@/lib/rsvp";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

// AE-1: admin "Email confirmation" — sends the same RSVP confirmation email a
// guest gets after RSVPing online, for an RSVP the couple recorded (or to
// resend one). The address defaults to the group's email; the admin may type
// another one for this send only (it is not saved on the group).
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as { code?: unknown; email?: unknown };
    const code = normalizeInviteCode(typeof body.code === "string" ? body.code : "");
    if (!code) {
      return NextResponse.json({ error: "Invitation code is required." }, { status: 400 });
    }
    const invitation = await getInvitationByCode(code);
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }
    if (invitation.rsvp.status === "pending") {
      return NextResponse.json(
        { error: "Record an RSVP for this group before emailing a confirmation." },
        { status: 400 },
      );
    }
    // Same strict check as the contact email (no spaces, ?, & or newlines).
    const to = normalizeContactEmail(
      typeof body.email === "string" && body.email.trim()
        ? body.email
        : invitation.email,
    );
    if (!to) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const content = await getPublishedContent();
    // The couple recorded or checked this RSVP themselves, so no "we'll
    // confirm your place" late sentence.
    const result = await sendRsvpConfirmationEmail({ content, invitation, to, late: false });
    if (result.status === "sent") {
      return NextResponse.json({ status: "sent", to });
    }
    console.error(
      `[admin-email] Confirmation ${result.status} for ${invitation.code}:`,
      result.reason ?? "",
    );
    return NextResponse.json(
      {
        status: result.status,
        error:
          result.status === "skipped"
            ? "The email service isn't set up, so nothing was sent."
            : "The email service didn't accept the message. Try again in a minute.",
      },
      { status: 502 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send the email." },
      { status: 400 },
    );
  }
}
