import { z } from "zod";
import type {
  EventKey,
  MealPreference,
  RsvpSubmission,
  SelfRegistrationSubmission,
  WeddingEvent
} from "@/lib/types";

export const eventKeys: EventKey[] = ["holy_matrimony", "tea_lunch", "dinner"];
export const mealPreferences: MealPreference[] = ["vegetarian", "non_vegetarian", "unset"];
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

export function isRsvpClosed(deadlineIso: string, now = new Date()) {
  return now.getTime() > new Date(deadlineIso).getTime();
}

const eventAttendanceSchema = z
  .object({
    holy_matrimony: z.boolean().optional(),
    tea_lunch: z.boolean().optional(),
    dinner: z.boolean().optional()
  })
  .default({});

export const rsvpSubmissionSchema = z.object({
  code: z.string().min(4).transform(normalizeInviteCode),
  status: z.enum(["attending", "declined"]),
  eventAttendance: eventAttendanceSchema,
  mealPreferences: z.record(z.string().min(1), z.enum(["vegetarian", "non_vegetarian", "unset"])),
  message: z.string().max(500).optional()
});

export function validateRsvpSubmission(payload: unknown): RsvpSubmission {
  return rsvpSubmissionSchema.parse(payload);
}

export const selfRegistrationSchema = z.object({
  accessCode: z.string().min(4).transform(normalizeInviteCode),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  guestCount: z.coerce.number().int().min(1).max(10),
  mealPreference: z.enum(["vegetarian", "non_vegetarian"]),
  status: z.enum(["attending", "declined"]),
  eventAttendance: eventAttendanceSchema,
  message: z.string().max(500).optional()
});

export function validateSelfRegistration(payload: unknown): SelfRegistrationSubmission {
  const parsed = selfRegistrationSchema.parse(payload);
  if (!isGenericInviteCode(parsed.accessCode)) {
    throw new Error("This invitation code cannot be used for self-registration.");
  }
  return parsed;
}

export function ensureEligibleEvents(
  requested: Partial<Record<EventKey, boolean>>,
  eligibleEvents: EventKey[]
) {
  const normalized: Partial<Record<EventKey, boolean>> = {};
  for (const eventKey of eligibleEvents) {
    normalized[eventKey] = Boolean(requested[eventKey]);
  }
  return normalized;
}

export function hasAtLeastOneAttendingEvent(attendance: Partial<Record<EventKey, boolean>>) {
  return Object.values(attendance).some(Boolean);
}

export function mealLabel(value: MealPreference) {
  if (value === "vegetarian") return "Vegetarian";
  if (value === "non_vegetarian") return "Non-vegetarian";
  return "Unset";
}

function eventDateTime(event: WeddingEvent) {
  const start = event.startTime.replace(":", "");
  const end = event.endTime?.replace(":", "") || addOneHour(event.startTime).replace(":", "");
  return {
    start: `${event.date.replaceAll("-", "")}T${start}00`,
    end: `${event.date.replaceAll("-", "")}T${end}00`
  };
}

function addOneHour(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return `${String((Number(hour) + 1) % 24).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function buildGoogleCalendarUrl(event: WeddingEvent, coupleName: string, timezone: string) {
  const dates = eventDateTime(event);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", `${coupleName} - ${event.title.en}`);
  url.searchParams.set("dates", `${dates.start}/${dates.end}`);
  url.searchParams.set("ctz", timezone);
  url.searchParams.set("location", `${event.venueName}, ${event.venueAddress}`);
  url.searchParams.set("details", event.note?.en || "Edward & Jessica wedding celebration.");
  return url.toString();
}

export function buildWhatsAppUrl(phone: string | undefined, inviteUrl: string, greeting: string) {
  const message = `${greeting}\n\nTogether with our families, we invite you to celebrate the wedding of Edward & Jessica.\n\nPlease open your invitation here:\n${inviteUrl}`;
  const url = new URL("https://wa.me/");
  if (phone) {
    url.pathname = phone.replace(/[^\d]/g, "");
  }
  url.searchParams.set("text", message);
  return url.toString();
}

export function generateInviteCode(seed: string) {
  const compactSeed = seed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `EJ26-${compactSeed.slice(0, 8) || random}-${random}`;
}

export function buildNameInviteCode(name: string, existingCodes: string[] = []) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 32) || "GUEST";
  const usedCodes = new Set(existingCodes.map(normalizeInviteCode).concat(GENERIC_INVITE_CODE));
  if (!usedCodes.has(base)) return base;

  let counter = 2;
  while (usedCodes.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}
