import { getSiteUrl } from "@/lib/env";
import { text } from "@/lib/i18n";
import type {
  InvitationGroup,
  Language,
  TravelPlan,
  WeddingContent,
} from "@/lib/types";

type RsvpEmailResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mealLabel(value: string) {
  if (value === "vegetarian") return "Vegetarian";
  if (value === "non_vegetarian") return "Non-vegetarian";
  return "Not selected";
}

function statusLabel(value: InvitationGroup["rsvp"]["status"]) {
  if (value === "attending") return "Attending";
  if (value === "declined") return "Not attending";
  return "Pending";
}

function accommodationLabel(value: TravelPlan["accommodationOption"]) {
  if (value === "specific_roommates") return "Room with specific guests";
  if (value === "assign_roommates") return "Happy for the couple to assign";
  return "Arranging own accommodation";
}

function formatTravelDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function selectedEvents(invitation: InvitationGroup, content: WeddingContent) {
  if (invitation.rsvp.status === "declined") return [];
  return content.events.filter(
    (eventItem) =>
      invitation.eligibleEvents.includes(eventItem.key) &&
      invitation.rsvp.eventAttendance[eventItem.key],
  );
}

export function buildRsvpConfirmationEmail({
  content,
  invitation,
  language = "en",
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  language?: Language;
}) {
  const inviteUrl = `${getSiteUrl().replace(/\/$/, "")}/invite/${encodeURIComponent(
    invitation.code,
  )}`;
  const events = selectedEvents(invitation, content);
  const guestRows = invitation.guests
    .map(
      (guest) =>
        `<li>${escapeHtml(guest.name)} - ${escapeHtml(
          mealLabel(guest.mealPreference),
        )}</li>`,
    )
    .join("");
  const eventRows = events.length
    ? events
        .map(
          (eventItem) =>
            `<li><strong>${escapeHtml(
              text(eventItem.shortTitle, language),
            )}</strong><br/>${escapeHtml(eventItem.startTime)} · ${escapeHtml(
              eventItem.venueName,
            )}</li>`,
        )
        .join("")
    : "<li>No wedding events selected.</li>";

  const subject =
    invitation.rsvp.status === "declined"
      ? "We received your RSVP for Edward & Jessica's wedding"
      : "Your RSVP for Edward & Jessica's wedding";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #2f2924; line-height: 1.55; max-width: 620px; margin: 0 auto;">
      <p style="letter-spacing: 0.18em; text-transform: uppercase; color: #aa7e52; font-weight: 700;">Edward & Jessica</p>
      <h1 style="font-family: Georgia, serif; font-size: 32px; line-height: 1.1; margin: 12px 0;">We received your RSVP</h1>
      <p>Hi ${escapeHtml(invitation.groupName)},</p>
      <p>Thank you for confirming your RSVP. Here are the details we have received:</p>

      <h2 style="font-size: 18px; margin-top: 28px;">RSVP Status</h2>
      <p>${escapeHtml(statusLabel(invitation.rsvp.status))}</p>

      <h2 style="font-size: 18px; margin-top: 28px;">Guests</h2>
      <ul>${guestRows}</ul>

      <h2 style="font-size: 18px; margin-top: 28px;">Events</h2>
      <ul>${eventRows}</ul>

      <p style="margin-top: 28px;">Your personal invitation link:</p>
      <p><a href="${escapeHtml(inviteUrl)}" style="color: #8f633a; font-weight: 700;">${escapeHtml(inviteUrl)}</a></p>

      <p style="margin-top: 28px;">Edward & Jessica may follow up if anything needs updating.</p>
      <p>With love,<br/>Edward & Jessica</p>
    </div>
  `;

  return { subject, html, inviteUrl };
}

export async function sendRsvpConfirmationEmail({
  content,
  invitation,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
}): Promise<RsvpEmailResult> {
  if (!invitation.email) {
    return { status: "skipped", reason: "Invitation has no email." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "skipped", reason: "RESEND_API_KEY is not configured." };
  }

  const from =
    process.env.RSVP_EMAIL_FROM ||
    "Edward & Jessica RSVP <rsvp@edwardjessica.com>";
  const replyTo =
    process.env.RSVP_EMAIL_REPLY_TO || "rsvp@edwardjessica.com";
  const { subject, html } = buildRsvpConfirmationEmail({
    content,
    invitation,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: invitation.email,
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => response.statusText);
    console.error("Unable to send RSVP confirmation email", reason);
    return { status: "failed", reason };
  }

  return { status: "sent" };
}

export function buildTravelPlanConfirmationEmail({
  content,
  invitation,
  travelPlan,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  travelPlan: TravelPlan;
}) {
  const inviteUrl = `${getSiteUrl().replace(/\/$/, "")}/invite/${encodeURIComponent(
    invitation.code,
  )}`;
  const subject = `We received your travel plans for ${content.coupleName}'s wedding`;
  const roommateRows = travelPlan.preferredRoommates
    ? `<p>${escapeHtml(travelPlan.preferredRoommates).replace(/\n/g, "<br/>")}</p>`
    : "<p>Not provided.</p>";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #2f2924; line-height: 1.55; max-width: 620px; margin: 0 auto;">
      <p style="letter-spacing: 0.18em; text-transform: uppercase; color: #aa7e52; font-weight: 700;">Edward & Jessica</p>
      <h1 style="font-family: Georgia, serif; font-size: 32px; line-height: 1.1; margin: 12px 0;">We received your travel plans</h1>
      <p>Hi ${escapeHtml(invitation.groupName)},</p>
      <p>Thank you for sharing your travel and accommodation details. Here is what we received:</p>

      <h2 style="font-size: 18px; margin-top: 28px;">Arrival</h2>
      <p>${escapeHtml(formatTravelDate(travelPlan.arrivalAt))}</p>

      <h2 style="font-size: 18px; margin-top: 28px;">Departure</h2>
      <p>${escapeHtml(formatTravelDate(travelPlan.departureAt))}</p>

      <h2 style="font-size: 18px; margin-top: 28px;">Accommodation Preference</h2>
      <p>${escapeHtml(accommodationLabel(travelPlan.accommodationOption))}</p>

      <h2 style="font-size: 18px; margin-top: 28px;">Preferred Roommates</h2>
      ${roommateRows}

      <p style="margin-top: 28px;">We will let you know the final room plan, pick-up time, and departure transport time closer to the date.</p>

      <p>Your invitation link:</p>
      <p><a href="${escapeHtml(inviteUrl)}" style="color: #8f633a; font-weight: 700;">${escapeHtml(inviteUrl)}</a></p>

      <p style="margin-top: 28px;">With love,<br/>Edward & Jessica</p>
    </div>
  `;

  return { subject, html, inviteUrl };
}

export async function sendTravelPlanConfirmationEmail({
  content,
  invitation,
  travelPlan,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  travelPlan: TravelPlan;
}): Promise<RsvpEmailResult> {
  if (!invitation.email) {
    return { status: "skipped", reason: "Invitation has no email." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "skipped", reason: "RESEND_API_KEY is not configured." };
  }

  const from =
    process.env.RSVP_EMAIL_FROM ||
    "Edward & Jessica RSVP <rsvp@edwardjessica.com>";
  const replyTo =
    process.env.RSVP_EMAIL_REPLY_TO || "rsvp@edwardjessica.com";
  const { subject, html } = buildTravelPlanConfirmationEmail({
    content,
    invitation,
    travelPlan,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: invitation.email,
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => response.statusText);
    console.error("Unable to send travel plan confirmation email", reason);
    return { status: "failed", reason };
  }

  return { status: "sent" };
}
