import { describe, expect, it } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildNameInviteCode,
  buildWhatsAppUrl,
  GENERIC_INVITE_CODE,
  ensureEligibleEvents,
  isGenericInviteCode,
  isRsvpClosed,
  normalizeInviteCode,
  validateInviteCode
} from "@/lib/rsvp";
import { weddingContent } from "@/lib/wedding-content";

describe("RSVP helpers", () => {
  it("normalizes and validates invite codes", () => {
    expect(normalizeInviteCode(" ej26-x7k92 ")).toBe("EJ26-X7K92");
    expect(validateInviteCode("ej26-x7k92")).toBe(true);
    expect(normalizeInviteCode("JESSmarriED")).toBe(GENERIC_INVITE_CODE);
    expect(isGenericInviteCode("JESSmarriED")).toBe(true);
    expect(validateInviteCode("JESSmarriED")).toBe(true);
    expect(validateInviteCode("guest-list")).toBe(false);
  });

  it("builds memorable self-registration codes from full names", () => {
    expect(buildNameInviteCode("John Tan")).toBe("JOHNTAN");
    expect(buildNameInviteCode("John Tan", ["JOHNTAN"])).toBe("JOHNTAN2");
    expect(buildNameInviteCode("Élodie Ang")).toBe("ELODIEANG");
  });

  it("locks RSVP after the configured deadline", () => {
    expect(isRsvpClosed("2026-09-01T16:59:59.000Z", new Date("2026-09-01T16:00:00.000Z"))).toBe(false);
    expect(isRsvpClosed("2026-09-01T16:59:59.000Z", new Date("2026-09-02T00:00:00.000Z"))).toBe(true);
  });

  it("keeps only eligible event attendance keys", () => {
    expect(
      ensureEligibleEvents(
        {
          holy_matrimony: true,
          tea_lunch: true,
          dinner: false
        },
        ["dinner"]
      )
    ).toEqual({ dinner: false });
  });

  it("builds calendar and WhatsApp URLs", () => {
    const calendar = buildGoogleCalendarUrl(weddingContent.events[0], weddingContent.coupleName, weddingContent.timezone);
    expect(calendar).toContain("calendar.google.com");
    expect(calendar).toContain("Asia%2FJakarta");

    const whatsapp = buildWhatsAppUrl("+62 812-345", "https://example.com/invite/EJ26-X7K92", "Dear Friends");
    expect(whatsapp).toContain("wa.me/62812345");
    expect(whatsapp).toContain("Edward+%26+Jessica");
  });
});
