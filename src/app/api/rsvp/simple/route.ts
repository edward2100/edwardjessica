import { NextResponse } from "next/server";
import {
  createSimpleRegisteredInvitation,
  getInvitationByVerifiedEmail,
  getPublishedContent,
} from "@/lib/data-store";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  findPublicInviteTypeByCode,
  firstNameOf,
  getEffectiveRsvpDeadline,
  getRsvpWindow,
  isSimplePublicInviteType,
  simpleRsvpSchema,
} from "@/lib/rsvp";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

// SF-4: RSVPs from a link set to the simple form: no email code, so no
// guest-auth cookie. Every other link keeps its email check (400 here).
export async function POST(request: Request) {
  // D4: same best-effort bucket as the other RSVP routes.
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
    const body: unknown = await request.json().catch(() => null);
    const rawBody = (
      body && typeof body === "object" ? body : {}
    ) as Record<string, unknown>;
    // SF-4: only an enabled link set to the simple form takes unverified
    // RSVPs; the standard links never do.
    const inviteType = findPublicInviteTypeByCode(
      content,
      typeof rawBody.accessCode === "string" ? rawBody.accessCode : "",
    );
    if (!inviteType || !isSimplePublicInviteType(inviteType)) {
      return NextResponse.json(
        { error: "This link can't be used." },
        { status: 400 },
      );
    }
    // LR-2: the link's own deadline; "late" is still accepted, "closed" not.
    const rsvpWindow = getRsvpWindow(
      getEffectiveRsvpDeadline(content, { inviteType }),
      content,
    );
    if (rsvpWindow === "closed") {
      return NextResponse.json({ error: "RSVP editing is closed." }, { status: 403 });
    }
    const late = rsvpWindow === "late";

    const parsed = simpleRsvpSchema(inviteType.maxGuests).safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Please check your details and try again.",
        },
        { status: 400 },
      );
    }
    const submission = parsed.data;
    const success = {
      ok: true,
      existing: false,
      firstName: firstNameOf(submission.name),
      status: submission.attending ? "attending" : "declined",
      guestCount: submission.guestCount,
    };

    // SF-4: a filled honeypot looks like success to the bot, but nothing is
    // saved or sent.
    if (submission.website?.trim()) {
      console.warn(
        `[rsvp-simple] Honeypot filled on link ${inviteType.code}; nothing saved or sent.`,
      );
      return NextResponse.json({ ...success, emailStatus: "skipped", late });
    }

    // SF-4: one RSVP per email across every invitation. A repeat changes
    // nothing, sends nothing and reveals nothing about the stored RSVP.
    if (await getInvitationByVerifiedEmail(submission.email)) {
      return NextResponse.json({ ok: true, existing: true });
    }
    const { invitation, existing } = await createSimpleRegisteredInvitation(
      submission,
      inviteType,
      {
        // DL-12: every published link code is reserved for name codes.
        reservedCodes: content.publicInviteTypes.map((item) => item.code),
      },
    );
    if (existing) return NextResponse.json({ ok: true, existing: true });

    // D1: email runs AFTER the successful save and can never throw past itself.
    const emailResult = await sendRsvpConfirmationEmail({
      content,
      invitation,
      late,
      kind: "simple",
      language: submission.language,
      dietary: submission.dietary,
    }).catch((err) => {
      console.error(
        `[rsvp-simple] Unexpected error sending confirmation email for ${invitation.code}:`,
        err,
      );
      return { status: "failed" as const, reason: String(err) };
    });
    if (emailResult.status !== "sent") {
      console.error(
        `[rsvp-simple] Email ${emailResult.status} for invitation ${invitation.code}:`,
        (emailResult as { reason?: string }).reason ?? "",
      );
    }

    // SF-4: no invitation code or invite URL for this form.
    return NextResponse.json({
      ...success,
      guestCount: invitation.guests.length,
      emailStatus: emailResult.status,
      late,
    });
  } catch (error) {
    console.error("[rsvp-simple] Unable to save RSVP:", error);
    return NextResponse.json(
      { error: "We could not save your RSVP. Please try again." },
      { status: 500 },
    );
  }
}
