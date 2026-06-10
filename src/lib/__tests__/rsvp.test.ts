import { describe, expect, it } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildWeddingCalendarIcs,
  buildNameInviteCode,
  buildWhatsAppUrl,
  GENERIC_INVITE_CODE,
  ensureEligibleEvents,
  findPublicInviteTypeByCode,
  isGenericInviteCode,
  isRsvpClosed,
  normalizeInviteCode,
  validateInviteCode,
  validateSelfRegistrationForInviteType,
} from "@/lib/rsvp";
import { buildRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";
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
    expect(
      isRsvpClosed(
        "2026-09-01T16:59:59.000Z",
        new Date("2026-09-01T16:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      isRsvpClosed(
        "2026-09-01T16:59:59.000Z",
        new Date("2026-09-02T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("keeps only eligible event attendance keys", () => {
    expect(
      ensureEligibleEvents(
        {
          holy_matrimony: true,
          tea_lunch: true,
          dinner: false,
        },
        ["dinner"],
      ),
    ).toEqual({ dinner: false });
  });

  it("resolves public invite types and enforces guest naming rules", () => {
    expect(findPublicInviteTypeByCode(weddingContent, "EJFAMILY")?.flow).toBe(
      "family",
    );
    expect(
      findPublicInviteTypeByCode(weddingContent, "EJOVERSEAS")?.maxGuests,
    ).toBe(1);
    expect(() =>
      validateSelfRegistrationForInviteType(
        {
          accessCode: "EJOVERSEAS",
          email: "overseas.guest@example.com",
          name: "Overseas Guest",
          phone: "+628111111",
          guestCount: 2,
          guestNames: ["Overseas Guest", "Plus One"],
          mealPreference: "vegetarian",
          status: "attending",
          eventAttendance: { dinner: true },
        },
        weddingContent,
      ),
    ).toThrow("This invitation allows up to 1 guest.");
    expect(() =>
      validateSelfRegistrationForInviteType(
        {
          accessCode: "JESSMARRIED",
          email: "guest.one@example.com",
          name: "Guest One",
          phone: "+628111111",
          guestCount: 2,
          mealPreference: "vegetarian",
          status: "attending",
          eventAttendance: { dinner: true },
        },
        weddingContent,
      ),
    ).toThrow("Please enter the name of every guest attending.");
    expect(
      validateSelfRegistrationForInviteType(
        {
          accessCode: "EJFAMILY",
          email: "family.contact@example.com",
          name: "Family Contact",
          phone: "+628111111",
          guestCount: 6,
          guestNames: ["A", "B", "C", "D", "E", "F"].map(
            (name) => `${name} Guest`,
          ),
          mealPreference: "non_vegetarian",
          status: "attending",
          eventAttendance: {
            holy_matrimony: true,
            tea_lunch: true,
            dinner: true,
          },
        },
        weddingContent,
      ).maxGuests,
    ).toBe(6);
  });

  it("builds calendar and WhatsApp URLs", () => {
    const calendar = buildGoogleCalendarUrl(
      weddingContent.events[0],
      weddingContent.coupleName,
      weddingContent.timezone,
    );
    expect(calendar).toContain("calendar.google.com");
    expect(calendar).toContain("Asia%2FJakarta");

    const whatsapp = buildWhatsAppUrl(
      "+62 812-345",
      "https://example.com/invite/EJ26-X7K92",
      "Dear Friends",
    );
    expect(whatsapp).toContain("wa.me/62812345");
    expect(whatsapp).toContain("Edward+%26+Jessica");
  });

  it("builds a multi-event wedding calendar file", () => {
    const calendar = buildWeddingCalendarIcs(
      weddingContent,
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(calendar).toContain(
      "SUMMARY:Edward & Jessica - Buddhist Wedding Ceremony",
    );
    expect(calendar).toContain(
      "SUMMARY:Edward & Jessica - Tea Ceremony & Lunch Buffet",
    );
    expect(calendar).toContain("SUMMARY:Edward & Jessica - Dinner Reception");
    expect(calendar).toContain("DTSTART;TZID=Asia/Jakarta:20261212T093000");
  });

  it("builds RSVP confirmation email content with personal invite link", () => {
    const email = buildRsvpConfirmationEmail({
      content: weddingContent,
      invitation: {
        id: "invite-email-test",
        code: "JOHNTAN",
        greeting: "Dear John Tan",
        groupName: "John Tan",
        email: "john@example.com",
        maxGuests: 1,
        side: "joint",
        source: "generic",
        flow: "generic",
        eligibleEvents: ["holy_matrimony", "dinner"],
        rsvp: {
          id: "rsvp-email-test",
          invitationGroupId: "invite-email-test",
          status: "attending",
          eventAttendance: { holy_matrimony: true, dinner: true },
        },
        guests: [
          {
            id: "guest-email-test",
            invitationGroupId: "invite-email-test",
            name: "John Tan",
            mealPreference: "vegetarian",
          },
        ],
      },
    });

    expect(email.subject).toContain("Edward & Jessica");
    expect(email.inviteUrl).toContain("/invite/JOHNTAN");
    expect(email.html).toContain("John Tan");
    expect(email.html).toContain("Buddhist Holy Matrimony");
  });
});
