import { z } from "zod";
import type {
  AdminWhatsAppMessageType,
  EventKey,
  InvitationGroup,
  MealPreference,
  PublicInviteType,
  RsvpContact,
  RsvpSubmission,
  SelfRegistrationSubmission,
  TravelAccommodationOption,
  TravelPlanSubmission,
  WeddingContent,
  WeddingEvent,
} from "@/lib/types";
import { RSVP_DEADLINE, WEDDING_TIMEZONE } from "@/lib/wedding-content";

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

// DL-2: canonical ISO instant for a stored deadline, or undefined for "",
// null and unparseable values, so a blank override can never be compared as
// NaN (fail-open) or crash Intl date formatting.
export function normalizeDeadlineIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const time = Date.parse(trimmed);
  if (!Number.isFinite(time)) return undefined;
  return new Date(time).toISOString();
}

// DL-2: the deadline that applies to one guest. Precedence: the invitation's
// own override (or the link snapshot taken at self-registration) -> the public
// link's deadline -> the main content deadline -> the code constant (only when
// the stored main deadline is blank or invalid).
export function getEffectiveRsvpDeadline(
  content: Pick<WeddingContent, "rsvpDeadline">,
  {
    invitation,
    inviteType,
  }: {
    invitation?: Pick<InvitationGroup, "rsvpDeadline"> | null;
    inviteType?: Pick<PublicInviteType, "rsvpDeadline"> | null;
  } = {},
): string {
  return (
    normalizeDeadlineIso(invitation?.rsvpDeadline) ??
    normalizeDeadlineIso(inviteType?.rsvpDeadline) ??
    normalizeDeadlineIso(content.rsvpDeadline) ??
    RSVP_DEADLINE
  );
}

// DL-7: the content object guest pages may serialize into the browser. The
// deadline is the one that applies to this visitor, and the list of public
// link codes is removed so one link's page can't reveal another link's code.
export function toGuestContent(
  content: WeddingContent,
  effectiveDeadline: string,
): WeddingContent {
  return {
    ...content,
    rsvpDeadline: effectiveDeadline,
    publicInviteTypes: [],
  };
}

// CL-11: the invitation fields guest pages may serialize into the browser.
// An explicit allowlist shared by /invite/[code], /discover-medan and
// /travel-accommodation so they can't drift: email, phone and privateNotes
// never leave the server (emailClaimed is the safe boolean stand-in).
export function toGuestInvitation(invitation: InvitationGroup): InvitationGroup {
  return {
    id: invitation.id,
    code: invitation.code,
    greeting: invitation.greeting,
    groupName: invitation.groupName,
    emailClaimed: Boolean(invitation.email),
    maxGuests: invitation.maxGuests,
    side: invitation.side,
    source: invitation.source,
    flow: invitation.flow,
    eligibleEvents: invitation.eligibleEvents,
    openedAt: invitation.openedAt,
    rsvp: invitation.rsvp,
    guests: invitation.guests,
    // No PII — booleans + dates that drive the travel page / RSVP form.
    travelOverrides: invitation.travelOverrides,
    // Per-invitation deadline override / link snapshot (not PII).
    rsvpDeadline: invitation.rsvpDeadline,
  };
}

// CL-8: whole days left to RSVP (rounded up, at least 1), or null once RSVP
// is closed. Built on isRsvpClosed so the countdown hides exactly when the
// closed state starts (no gap at the deadline instant).
export function getRsvpDaysLeft(
  deadlineIso: string,
  now = new Date(),
): number | null {
  if (isRsvpClosed(deadlineIso, now)) return null;
  const msLeft = new Date(deadlineIso).getTime() - now.getTime();
  if (!Number.isFinite(msLeft)) return null;
  return Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

const WHATSAPP_HOSTS = new Set(["wa.me", "api.whatsapp.com", "whatsapp.com"]);

// CL-3: a WhatsApp contact link guests can safely open. A full https link on
// a WhatsApp host is kept verbatim (e.g. the wa.me/message/... short link);
// a phone number (digits, +, spaces, dashes, dots, brackets) becomes
// https://wa.me/<digits>. Anything else (http:, javascript:, other hosts,
// local numbers starting with 0) is rejected -> undefined.
export function normalizeWhatsAppUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[+\d\s().-]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15 || digits.startsWith("0")) {
      return undefined;
    }
    return `https://wa.me/${digits}`;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  if (url.username || url.password) return undefined;
  if (!WHATSAPP_HOSTS.has(url.hostname.toLowerCase())) return undefined;
  return trimmed;
}

// CL-3: trimmed contact email, or undefined unless it is one plain address.
// Only letters, digits and . _ + - are allowed around the @, so the value
// can't add mailto: header fields (?bcc=, &body=, %0D%0A, #) to the link.
export function normalizeContactEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return undefined;
  return /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(trimmed)
    ? trimmed
    : undefined;
}

// CL-3: keep only valid contact fields. An object with no valid field is
// returned as {} (the "cleared" representation), never undefined, so a
// cleared contact survives save + publish instead of falling back to the
// code default.
export function normalizeRsvpContact(value: unknown): RsvpContact {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const whatsappUrl = normalizeWhatsAppUrl(source.whatsappUrl);
  const email = normalizeContactEmail(source.email);
  return {
    ...(whatsappUrl ? { whatsappUrl } : {}),
    ...(email ? { email } : {}),
  };
}

export function hasRsvpContact(contact: RsvpContact | undefined) {
  return Boolean(contact?.whatsappUrl || contact?.email);
}

// DL-11: human date for a deadline in the wedding timezone, e.g.
// "12 October 2026" (en) / "12 Oktober 2026" (id).
export function formatRsvpDeadlineDate(
  deadlineIso: string,
  timeZone: string = WEDDING_TIMEZONE,
  language: "en" | "id" = "en",
) {
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(deadlineIso));
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

// C1: sanity window for travel dates — the wedding is 12 Dec 2026 in Medan.
// Lower bound: 2026-11-01T00:00Z, upper bound: 2027-01-16T00:00Z.
const TRAVEL_DATE_MIN = new Date("2026-11-01T00:00:00Z");
const TRAVEL_DATE_MAX = new Date("2027-01-16T00:00:00Z");

export const travelPlanSubmissionSchema = z
  .object({
    code: z.string().min(4).transform(normalizeInviteCode),
    arrivalAt: z.string().min(1),
    departureAt: z.string().min(1),
    accommodationOption: z.enum(travelAccommodationOptions),
    preferredRoommates: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    const arrivalDate = new Date(value.arrivalAt);
    const departureDate = new Date(value.departureAt);

    const arrivalValid = !Number.isNaN(arrivalDate.getTime());
    const departureValid = !Number.isNaN(departureDate.getTime());

    if (!arrivalValid) {
      context.addIssue({
        code: "custom",
        path: ["arrivalAt"],
        message: "Please enter a valid arrival time.",
      });
    }
    if (!departureValid) {
      context.addIssue({
        code: "custom",
        path: ["departureAt"],
        message: "Please enter a valid departure time.",
      });
    }

    // C1: date-range sanity check — both dates must fall within the travel window
    if (arrivalValid) {
      if (
        arrivalDate < TRAVEL_DATE_MIN ||
        arrivalDate > TRAVEL_DATE_MAX
      ) {
        context.addIssue({
          code: "custom",
          path: ["arrivalAt"],
          message:
            "Please check your travel dates — they should be around December 2026.",
        });
      }
    }
    if (departureValid) {
      if (
        departureDate < TRAVEL_DATE_MIN ||
        departureDate > TRAVEL_DATE_MAX
      ) {
        context.addIssue({
          code: "custom",
          path: ["departureAt"],
          message:
            "Please check your travel dates — they should be around December 2026.",
        });
      }
    }

    // C1: departure must not be before arrival
    if (arrivalValid && departureValid) {
      if (departureDate < arrivalDate) {
        context.addIssue({
          code: "custom",
          path: ["departureAt"],
          message: "Departure must be after arrival.",
        });
      }
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

  // C5: reject if the country code has no digits after stripping the leading '+'
  const digitsInCode = normalizedCode.replace(/[^\d]/g, "");
  if (!digitsInCode) {
    throw new Error(
      "Please enter a valid country code. / Harap masukkan kode negara yang valid.",
    );
  }

  const normalizedLocal = localNumber
    .trim()
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");

  // C5: reject if the local number has no digits after cleaning
  if (!normalizedLocal) {
    throw new Error(
      "Please enter a valid phone number. / Harap masukkan nomor telepon yang valid.",
    );
  }

  return `${normalizedCode} ${normalizedLocal}`;
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

// C2: addOneHour may advance past midnight. Returns { time, dayOffset } so the
// caller can advance the date by one day when dayOffset === 1.
function addOneHour(time: string): { time: string; dayOffset: 0 | 1 } {
  const [hour = "0", minute = "0"] = time.split(":");
  const nextHour = Number(hour) + 1;
  if (nextHour >= 24) {
    // Wraps into the next day
    return {
      time: `${String(nextHour - 24).padStart(2, "0")}:${minute.padStart(2, "0")}`,
      dayOffset: 1,
    };
  }
  return {
    time: `${String(nextHour).padStart(2, "0")}:${minute.padStart(2, "0")}`,
    dayOffset: 0,
  };
}

/** Advance an ISO date string (YYYY-MM-DD) by the given number of days. */
function advanceDateByDays(dateStr: string, days: number): string {
  if (days === 0) return dateStr;
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eventDateTime(event: WeddingEvent) {
  const startCompact = event.startTime.replace(":", "");
  let endCompact: string;
  let endDate = event.date;

  if (event.endTime) {
    endCompact = event.endTime.replace(":", "");
    // C2: if endTime is earlier than startTime on the same day, the event
    // crosses midnight — advance the end date by one day.
    if (event.endTime < event.startTime) {
      endDate = advanceDateByDays(event.date, 1);
    }
  } else {
    const { time, dayOffset } = addOneHour(event.startTime);
    endCompact = time.replace(":", "");
    endDate = advanceDateByDays(event.date, dayOffset);
  }

  return {
    start: `${event.date.replaceAll("-", "")}T${startCompact}00`,
    end: `${endDate.replaceAll("-", "")}T${endCompact}00`,
  };
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

// C3: RFC 5545 §3.1 requires folding at 75 octets (74 content + CRLF).
// Measure in UTF-8 bytes via TextEncoder and never split a multi-byte sequence.
// The continuation line starts with a single SPACE (1 octet), leaving 74 octets
// for content on continuation lines. We use 74 for all lines (conservative,
// matching the original intent and remaining RFC-compliant).
function foldIcsLine(line: string): string {
  // Fast path: ASCII-only lines where char count === byte count.
  if (line.length <= 74 && !/[^\x00-\x7f]/.test(line)) return line;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);

  if (bytes.length <= 74) return line;

  const chunks: string[] = [];
  const decoder = new TextDecoder("utf-8");
  let offset = 0;
  const maxBytes = 74;

  while (offset < bytes.length) {
    // All lines (first and continuation) get the same 74-byte budget.
    // Continuation lines have a leading SPACE prepended by the join, so the
    // total physical line width is 1 (SPACE) + up to 74 bytes = 75 max.
    if (offset + maxBytes >= bytes.length) {
      // Remaining bytes fit in one chunk
      chunks.push(decoder.decode(bytes.slice(offset)));
      break;
    }
    // Find the largest slice that is at most maxBytes and does not split
    // a multi-byte UTF-8 sequence. UTF-8 continuation bytes are 0x80-0xBF.
    let cut = offset + maxBytes;
    while (cut > offset && (bytes[cut]! & 0xc0) === 0x80) {
      cut -= 1;
    }
    chunks.push(decoder.decode(bytes.slice(offset, cut)));
    offset = cut;
  }

  // Continuation lines must start with a single SPACE (RFC 5545 §3.1).
  return chunks.join("\r\n ");
}

// C4: VTIMEZONE block for Asia/Jakarta.
// Jakarta is UTC+7 year-round with no DST (single STANDARD component).
// TZOFFSETFROM and TZOFFSETTO are both +0700.
// DTSTART is set to a historic date that predates the wedding by many years,
// satisfying RFC 5545 §3.6.5 (DTSTART is required for STANDARD/DAYLIGHT).
const VTIMEZONE_ASIA_JAKARTA = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Jakarta",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0700",
  "TZOFFSETTO:+0700",
  "TZNAME:WIB",
  "END:STANDARD",
  "END:VTIMEZONE",
];

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

  // C4: emit VTIMEZONE before events so TZID references in DTSTART/DTEND are valid
  lines.push(...VTIMEZONE_ASIA_JAKARTA);

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
  now = new Date(),
}: {
  invitation: InvitationGroup;
  content: WeddingContent;
  messageType: AdminWhatsAppMessageType;
  baseUrl: string;
  now?: Date;
}) {
  const siteUrl = baseUrl.replace(/\/$/, "");
  const inviteUrl = `${siteUrl}/invite/${encodeURIComponent(invitation.code)}`;
  const travelUrl = `${siteUrl}/travel-accommodation?code=${encodeURIComponent(
    invitation.code,
  )}`;
  // DL-11: the invitation's effective deadline as a readable Jakarta date,
  // not the raw ISO string of the global deadline. "until", not "before":
  // the deadline day itself is still open (deadlines are set to 23:59 WIB).
  const effectiveDeadline = getEffectiveRsvpDeadline(content, { invitation });
  const deadline = formatRsvpDeadlineDate(
    effectiveDeadline,
    content.timezone || WEDDING_TIMEZONE,
  );
  // Once the deadline has passed (e.g. a late RSVP recorded by the admin),
  // don't promise updates until a date in the past.
  const updateLine = isRsvpClosed(effectiveDeadline, now)
    ? "If anything changes, just reply to this message."
    : `You may update your RSVP until ${deadline}.`;

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

${updateLine}

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
  reservedCodes: string[] = [],
) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 32) || "GUEST";
  // DL-12: never hand out a personal code equal to a public link code
  // (reservedCodes), or that guest's invite would shadow the link at
  // /invite/<CODE>.
  const usedCodes = new Set(
    existingCodes
      .concat(reservedCodes)
      .map(normalizeInviteCode)
      .concat(GENERIC_INVITE_CODE),
  );
  if (!usedCodes.has(base)) return base;

  let counter = 2;
  while (usedCodes.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}
