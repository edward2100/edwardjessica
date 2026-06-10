import { z } from "zod";
import type {
  AdminWhatsAppMessageType,
  EventKey,
  InvitationGroup,
  MealPreference,
  RsvpSubmission,
  SelfRegistrationSubmission,
  TravelAccommodationOption,
  TravelPlanSubmission,
  WeddingContent,
  WeddingEvent,
} from "@/lib/types";

export const eventKeys: EventKey[] = ["holy_matrimony", "tea_lunch", "dinner"];
export const mealPreferences: MealPreference[] = [
  "vegetarian",
  "non_vegetarian",
  "unset",
];
export const travelAccommodationOptions: TravelAccommodationOption[] = [
  "specific_roommates",
  "assign_roommates",
  "own_accommodation",
];
export const GENERIC_INVITE_CODE = "JESSMARRIED";

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateInviteCode(code: string) {
  const normalized = normalizeInviteCode(code);
  return (
    /^EJ26-[A-Z0-9-]{4,24}$/.test(normalized) ||
    /^[A-Z0-9]{3,40}$/.test(normalized) ||
    normalized === GENERIC_INVITE_CODE
  );
}

export function isGenericInviteCode(code: string) {
  return normalizeInviteCode(code) === GENERIC_INVITE_CODE;
}

export function findPublicInviteTypeByCode(
  content: WeddingContent,
  code: string,
) {
  const normalized = normalizeInviteCode(code);
  return content.publicInviteTypes.find(
    (inviteType) =>
      inviteType.isEnabled &&
      normalizeInviteCode(inviteType.code) === normalized,
  );
}

export function getPublicInviteTypeById(content: WeddingContent, id: string) {
  return (
    content.publicInviteTypes.find((inviteType) => inviteType.id === id) ||
    content.publicInviteTypes[0]
  );
}

export function getDefaultPublicInviteType(content: WeddingContent) {
  return getPublicInviteTypeById(content, "generic");
}

export function isRsvpClosed(deadlineIso: string, now = new Date()) {
  return now.getTime() > new Date(deadlineIso).getTime();
}

const eventAttendanceSchema = z
  .object({
    holy_matrimony: z.boolean().optional(),
    tea_lunch: z.boolean().optional(),
    dinner: z.boolean().optional(),
  })
  .default({});

export const rsvpSubmissionSchema = z.object({
  code: z.string().min(4).transform(normalizeInviteCode),
  status: z.enum(["attending", "declined"]),
  eventAttendance: eventAttendanceSchema,
  mealPreferences: z.record(
    z.string().min(1),
    z.enum(["vegetarian", "non_vegetarian", "unset"]),
  ),
  additionalGuests: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(2).max(120),
        mealPreference: z.enum(["vegetarian", "non_vegetarian", "unset"]),
      }),
    )
    .max(10)
    .optional(),
  message: z.string().max(500).optional(),
});

export function validateRsvpSubmission(payload: unknown): RsvpSubmission {
  return rsvpSubmissionSchema.parse(payload);
}

export const selfRegistrationSchema = z.object({
  accessCode: z.string().min(4).transform(normalizeInviteCode),
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  guestCount: z.coerce.number().int().min(1).max(10),
  guestNames: z.array(z.string().trim().min(2).max(120)).max(10).optional(),
  mealPreference: z.enum(["vegetarian", "non_vegetarian"]),
  status: z.enum(["attending", "declined"]),
  eventAttendance: eventAttendanceSchema,
  message: z.string().max(500).optional(),
});

export function validateSelfRegistration(
  payload: unknown,
): SelfRegistrationSubmission {
  return selfRegistrationSchema.parse(payload);
}

export const travelPlanSubmissionSchema = z
  .object({
    code: z.string().min(4).transform(normalizeInviteCode),
    arrivalAt: z.string().min(1),
    departureAt: z.string().min(1),
    accommodationOption: z.enum(travelAccommodationOptions),
    preferredRoommates: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (Number.isNaN(new Date(value.arrivalAt).getTime())) {
      context.addIssue({
        code: "custom",
        path: ["arrivalAt"],
        message: "Please enter a valid arrival time.",
      });
    }
    if (Number.isNaN(new Date(value.departureAt).getTime())) {
      context.addIssue({
        code: "custom",
        path: ["departureAt"],
        message: "Please enter a valid departure time.",
      });
    }
    if (
      value.accommodationOption === "specific_roommates" &&
      !value.preferredRoommates?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["preferredRoommates"],
        message: "Please enter your preferred roommates.",
      });
    }
  });

export function validateTravelPlanSubmission(
  payload: unknown,
): TravelPlanSubmission {
  return travelPlanSubmissionSchema.parse(payload);
}

export function validateSelfRegistrationForInviteType(
  submission: SelfRegistrationSubmission,
  content: WeddingContent,
) {
  const inviteType = findPublicInviteTypeByCode(content, submission.accessCode);
  if (!inviteType) {
    throw new Error(
      "This invitation code cannot be used for self-registration.",
    );
  }
  if (submission.guestCount > inviteType.maxGuests) {
    const guestWord = inviteType.maxGuests === 1 ? "guest" : "guests";
    throw new Error(
      `This invitation allows up to ${inviteType.maxGuests} ${guestWord}.`,
    );
  }

  const needsGuestNames =
    submission.status === "attending" &&
    (inviteType.requireGuestNames ||
      inviteType.flow === "family" ||
      submission.guestCount > 1);
  if (needsGuestNames) {
    const guestNames = submission.guestNames || [];
    if (
      guestNames.length < submission.guestCount ||
      guestNames.some((name) => !name.trim())
    ) {
      throw new Error("Please enter the name of every guest attending.");
    }
  }

  return inviteType;
}

export function normalizePhoneNumber(countryCode: string, localNumber: string) {
  const cleanedCode = countryCode.trim().replace(/[^\d+]/g, "");
  const normalizedCode = cleanedCode.startsWith("+")
    ? cleanedCode
    : `+${cleanedCode}`;
  const normalizedLocal = localNumber
    .trim()
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");
  return `${normalizedCode} ${normalizedLocal}`.trim();
}

export function ensureEligibleEvents(
  requested: Partial<Record<EventKey, boolean>>,
  eligibleEvents: EventKey[],
) {
  const normalized: Partial<Record<EventKey, boolean>> = {};
  for (const eventKey of eligibleEvents) {
    normalized[eventKey] = Boolean(requested[eventKey]);
  }
  return normalized;
}

export function hasAtLeastOneAttendingEvent(
  attendance: Partial<Record<EventKey, boolean>>,
) {
  return Object.values(attendance).some(Boolean);
}

export function mealLabel(value: MealPreference) {
  if (value === "vegetarian") return "Vegetarian";
  if (value === "non_vegetarian") return "Non-vegetarian";
  return "Unset";
}

function eventDateTime(event: WeddingEvent) {
  const start = event.startTime.replace(":", "");
  const end =
    event.endTime?.replace(":", "") ||
    addOneHour(event.startTime).replace(":", "");
  return {
    start: `${event.date.replaceAll("-", "")}T${start}00`,
    end: `${event.date.replaceAll("-", "")}T${end}00`,
  };
}

function addOneHour(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return `${String((Number(hour) + 1) % 24).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function buildGoogleCalendarUrl(
  event: WeddingEvent,
  coupleName: string,
  timezone: string,
) {
  const dates = eventDateTime(event);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", `${coupleName} - ${event.title.en}`);
  url.searchParams.set("dates", `${dates.start}/${dates.end}`);
  url.searchParams.set("ctz", timezone);
  url.searchParams.set("location", `${event.venueName}, ${event.venueAddress}`);
  url.searchParams.set(
    "details",
    event.note?.en || "Edward & Jessica wedding celebration.",
  );
  return url.toString();
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string) {
  const maxLength = 74;
  if (line.length <= maxLength) return line;
  const chunks = [];
  let remaining = line;
  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = ` ${remaining.slice(maxLength)}`;
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
}

export function buildWeddingCalendarIcs(
  content: WeddingContent,
  now = new Date(),
) {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Edward Jessica Wedding//Wedding Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(content.coupleName)}`,
    `X-WR-TIMEZONE:${content.timezone}`,
  ];

  for (const event of content.events) {
    const dates = eventDateTime(event);
    const details = event.note?.en || "Edward & Jessica wedding celebration.";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.key}-${event.date}@edward-jessica-wedding`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;TZID=${content.timezone}:${dates.start}`,
      `DTEND;TZID=${content.timezone}:${dates.end}`,
      `SUMMARY:${escapeIcsText(`${content.coupleName} - ${event.title.en}`)}`,
      `LOCATION:${escapeIcsText(`${event.venueName}, ${event.venueAddress}`)}`,
      `DESCRIPTION:${escapeIcsText(details)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function buildWhatsAppUrl(
  phone: string | undefined,
  inviteUrl: string,
  greeting: string,
) {
  const message = `${greeting}\n\nTogether with our families, we invite you to celebrate the wedding of Edward & Jessica.\n\nPlease open your invitation here:\n${inviteUrl}`;
  const url = new URL("https://wa.me/");
  if (phone) {
    url.pathname = phone.replace(/[^\d]/g, "");
  }
  url.searchParams.set("text", message);
  return url.toString();
}

export function buildWhatsAppMessageUrl(
  phone: string | undefined,
  message: string,
) {
  const url = new URL("https://wa.me/");
  if (phone) url.pathname = phone.replace(/[^\d]/g, "");
  url.searchParams.set("text", message);
  return url.toString();
}

function adminStatusLabel(status: InvitationGroup["rsvp"]["status"]) {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Not attending";
  return "Pending";
}

function adminMealLabel(value: MealPreference) {
  if (value === "vegetarian") return "Vegetarian";
  if (value === "non_vegetarian") return "Non-vegetarian";
  return "Not selected";
}

function adminEventLines(invitation: InvitationGroup, content: WeddingContent) {
  const eventLines = content.events
    .filter((eventItem) => invitation.eligibleEvents.includes(eventItem.key))
    .filter((eventItem) =>
      invitation.rsvp.status === "attending"
        ? invitation.rsvp.eventAttendance[eventItem.key]
        : true,
    )
    .map((eventItem) => `- ${eventItem.shortTitle.en}`);
  return eventLines.length ? eventLines.join("\n") : "- No events selected";
}

function adminGuestLines(invitation: InvitationGroup) {
  return invitation.guests
    .map((guest) => `- ${guest.name} (${adminMealLabel(guest.mealPreference)})`)
    .join("\n");
}

export function buildAdminWhatsAppMessage({
  invitation,
  content,
  messageType,
  baseUrl,
}: {
  invitation: InvitationGroup;
  content: WeddingContent;
  messageType: AdminWhatsAppMessageType;
  baseUrl: string;
}) {
  const siteUrl = baseUrl.replace(/\/$/, "");
  const inviteUrl = `${siteUrl}/invite/${encodeURIComponent(invitation.code)}`;
  const travelUrl = `${siteUrl}/travel-accommodation?code=${encodeURIComponent(
    invitation.code,
  )}`;
  const deadline = content.rsvpDeadline;

  if (messageType === "rsvp_confirmation") {
    return `${invitation.greeting}

Thank you for your RSVP to Edward & Jessica's wedding.

Status: ${adminStatusLabel(invitation.rsvp.status)}

Events:
${adminEventLines(invitation, content)}

Guests:
${adminGuestLines(invitation)}

Your invitation link:
${inviteUrl}

You may update your RSVP before ${deadline}.

With love,
Edward & Jessica`;
  }

  if (messageType === "travel_plans") {
    return `${invitation.greeting}

Thank you for confirming your RSVP. For travel and accommodation arrangements, please submit your travel plans here:

${travelUrl}

We will let you know the final room plan, pick-up time, and departure transport time closer to the date.

With love,
Edward & Jessica`;
  }

  return `${invitation.greeting}

Together with our families, we invite you to celebrate the wedding of Edward & Jessica.

Please open your invitation here:
${inviteUrl}`;
}

export function generateInviteCode(seed: string) {
  const compactSeed = seed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `EJ26-${compactSeed.slice(0, 8) || random}-${random}`;
}

export function buildNameInviteCode(
  name: string,
  existingCodes: string[] = [],
) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 32) || "GUEST";
  const usedCodes = new Set(
    existingCodes.map(normalizeInviteCode).concat(GENERIC_INVITE_CODE),
  );
  if (!usedCodes.has(base)) return base;

  let counter = 2;
  while (usedCodes.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}
