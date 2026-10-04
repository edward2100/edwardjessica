import type { AdminInvitationUpsert, InvitationGroup } from "@/lib/types";

// Admin form helpers shared by the dashboard (client) and the tests, so the
// tests exercise the exact payloads the dashboard sends.

export function invitationToDraft(
  invitation: InvitationGroup,
): AdminInvitationUpsert {
  return {
    code: invitation.code,
    groupName: invitation.groupName,
    greeting: invitation.greeting,
    phone: invitation.phone || "",
    email: invitation.email || "",
    maxGuests: invitation.maxGuests || invitation.guests.length || 1,
    side: invitation.side,
    flow: invitation.flow,
    privateNotes: {
      en: invitation.privateNotes?.en || "",
      id: invitation.privateNotes?.id || "",
    },
    eligibleEvents: invitation.eligibleEvents,
    guests: invitation.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      mealPreference: guest.mealPreference,
    })),
    travelOverrides: invitation.travelOverrides,
    // DL-10: carried so full-row saves (incl. the inline flow dropdown) keep
    // the override.
    rsvpDeadline: invitation.rsvpDeadline,
  };
}

/**
 * Convert an ISO instant string to a datetime-local value rendered in
 * Asia/Jakarta wall time (UTC+7). The returned string is always in the
 * format required by <input type="datetime-local">: "YYYY-MM-DDTHH:mm".
 * This ensures the deadline editor always shows the correct Jakarta time
 * regardless of the admin's browser timezone.
 */
export function isoToJakartaLocal(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso.slice(0, 16);
  // Extract wall-time parts in Asia/Jakarta
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Convert a datetime-local input value (treated as Asia/Jakarta wall time)
 * back to an ISO 8601 string with a +07:00 offset. This avoids the
 * browser-timezone ambiguity of `new Date(value)` and ensures that repeated
 * open/save cycles of the deadline editor are byte-stable.
 *
 * Deadlines are inclusive of the chosen minute: "23:59" is stored as
 * 23:59:59, matching the live main deadline (12 Oct 23:59:59 WIB), so a
 * guest submitting at 23:59:30 is still in time.
 */
export function jakartaLocalToIso(localValue: string): string {
  if (!localValue) return "";
  // localValue is "YYYY-MM-DDTHH:mm" — append the end of that minute and the
  // Jakarta offset directly.
  return `${localValue}:59+07:00`;
}
