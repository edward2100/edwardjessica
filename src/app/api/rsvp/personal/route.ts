import { NextResponse } from "next/server";
import {
  getInvitationByCode,
  getPublishedContent,
  submitPersonalRsvp,
} from "@/lib/data-store";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  findPersonalLinkByCode,
  getEffectiveRsvpDeadline,
  getRsvpWindow,
  personalRsvpSchema,
  toPersonalInvite,
} from "@/lib/rsvp";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

// PL-3: RSVPs from a personal link (/JESSmarriED-2295A3FMJQWX). Like the simple form
// there is no email code: the link's code is the key. Only a code owned by an
// enabled simple link is accepted, so no other invitation can be changed here.
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
    const code = typeof rawBody.code === "string" ? rawBody.code : "";
    const link = findPersonalLinkByCode(content, code);
    const invitation = link ? await getInvitationByCode(code) : null;
    if (!link || !invitation) {
      return NextResponse.json(
        { error: "This link can't be used." },
        { status: 400 },
      );
    }
    // DL-7: the invitation's own deadline (stamped from its link at import),
    // else the link's; "late" is still accepted, "closed" not.
    const rsvpWindow = getRsvpWindow(
      getEffectiveRsvpDeadline(content, { invitation, inviteType: link }),
      content,
    );
    if (rsvpWindow === "closed") {
      return NextResponse.json({ error: "RSVP editing is closed." }, { status: 403 });
    }
    const late = rsvpWindow === "late";

    const parsed = personalRsvpSchema(invitation.maxGuests).safeParse({
      ...rawBody,
      code: invitation.code,
    });
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

    // SF-4: a filled honeypot looks like success to the bot, but nothing is
    // saved or sent.
    if (submission.website?.trim()) {
      console.warn(
        `[rsvp-personal] Honeypot filled for ${invitation.code}; nothing saved or sent.`,
      );
      return NextResponse.json({
        ok: true,
        invite: toPersonalInvite(invitation),
        emailStatus: "skipped",
        late,
      });
    }

    const updated = await submitPersonalRsvp(invitation, submission);

    // D1: email runs AFTER the successful save and can never throw past
    // itself. Only when the guest gave an address on this answer.
    let emailStatus = "skipped";
    if (submission.email) {
      const emailResult = await sendRsvpConfirmationEmail({
        content,
        invitation: updated,
        late,
        to: submission.email,
        kind: "simple",
        language: submission.language,
        dietary: submission.attending ? submission.dietary : undefined,
      }).catch((err) => {
        console.error(
          `[rsvp-personal] Unexpected error sending confirmation email for ${updated.code}:`,
          err,
        );
        return { status: "failed" as const, reason: String(err) };
      });
      emailStatus = emailResult.status;
      if (emailResult.status !== "sent") {
        console.error(
          `[rsvp-personal] Email ${emailResult.status} for invitation ${updated.code}:`,
          (emailResult as { reason?: string }).reason ?? "",
        );
      }
    }

    return NextResponse.json({
      ok: true,
      invite: toPersonalInvite(updated),
      emailStatus,
      late,
    });
  } catch (error) {
    console.error("[rsvp-personal] Unable to save RSVP:", error);
    return NextResponse.json(
      { error: "We could not save your RSVP. Please try again." },
      { status: 500 },
    );
  }
}
