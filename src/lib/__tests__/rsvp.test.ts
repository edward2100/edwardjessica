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
  normalizePhoneNumber,
  validateInviteCode,
  validateSelfRegistrationForInviteType,
  validateTravelPlanSubmission,
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

  // C1: travel plan date validation
  describe("validateTravelPlanSubmission — travel date validation (C1)", () => {
    const validBase = {
      code: "JESSMARRIED",
      accommodationOption: "own_accommodation" as const,
    };

    it("accepts dates within the sanity window", () => {
      expect(() =>
        validateTravelPlanSubmission({
          ...validBase,
          arrivalAt: "2026-12-10T10:00:00Z",
          departureAt: "2026-12-14T10:00:00Z",
        }),
      ).not.toThrow();
    });

    it("rejects arrivalAt before the travel window", () => {
      const result = validateTravelPlanSubmission.bind(null, {
        ...validBase,
        arrivalAt: "2026-10-01T00:00:00Z",
        departureAt: "2026-12-14T00:00:00Z",
      });
      expect(result).toThrow();
    });

    it("rejects departureAt after the travel window", () => {
      const result = validateTravelPlanSubmission.bind(null, {
        ...validBase,
        arrivalAt: "2026-12-10T00:00:00Z",
        departureAt: "2027-02-01T00:00:00Z",
      });
      expect(result).toThrow();
    });

    it("rejects departure before arrival", () => {
      let errorMessages: string[] = [];
      try {
        validateTravelPlanSubmission({
          ...validBase,
          arrivalAt: "2026-12-14T10:00:00Z",
          departureAt: "2026-12-10T10:00:00Z",
        });
      } catch (e: unknown) {
        // Zod v4 uses .issues; v3 used .errors — check both for compatibility.
        const issues =
          e && typeof e === "object" && "issues" in e
            ? (e as { issues: Array<{ message: string }> }).issues
            : e && typeof e === "object" && "errors" in e
              ? (e as { errors: Array<{ message: string }> }).errors
              : null;
        if (Array.isArray(issues)) {
          errorMessages = issues.map((err) => err.message);
        }
      }
      expect(errorMessages.some((m) => m.includes("Departure must be after arrival"))).toBe(true);
    });

    it("accepts same arrival and departure time (edge: instant stay)", () => {
      expect(() =>
        validateTravelPlanSubmission({
          ...validBase,
          arrivalAt: "2026-12-12T12:00:00Z",
          departureAt: "2026-12-12T12:00:00Z",
        }),
      ).not.toThrow();
    });
  });

  // C2: midnight wrap in calendar date computation
  it("advances end date by one day when event end crosses midnight (C2)", () => {
    const content = {
      ...weddingContent,
      events: [
        {
          ...weddingContent.events[0],
          date: "2026-12-12",
          startTime: "23:00",
          endTime: "01:00", // next day
        },
      ],
    };
    const ics = buildWeddingCalendarIcs(content, new Date("2026-01-01T00:00:00.000Z"));
    // DTEND should be on the 13th, not the 12th
    expect(ics).toContain("DTEND;TZID=Asia/Jakarta:20261213T010000");
  });

  it("advances end date when addOneHour wraps past midnight (C2)", () => {
    const content = {
      ...weddingContent,
      events: [
        {
          ...weddingContent.events[0],
          date: "2026-12-12",
          startTime: "23:30",
          endTime: undefined, // relies on +1 hour default
        },
      ],
    };
    const ics = buildWeddingCalendarIcs(content, new Date("2026-01-01T00:00:00.000Z"));
    expect(ics).toContain("DTEND;TZID=Asia/Jakarta:20261213T003000");
  });

  // C3: ICS folding at 74 octets, multi-byte safe
  it("folds ICS lines at 74 octets without splitting multi-byte chars (C3)", () => {
    // Build a calendar with a long description full of multi-byte characters.
    // Each Japanese character is 3 UTF-8 bytes.
    const longNote = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ"; // 30 × 3 = 90 bytes
    const content = {
      ...weddingContent,
      events: [
        {
          ...weddingContent.events[0],
          note: { en: longNote, id: longNote },
        },
      ],
    };
    const ics = buildWeddingCalendarIcs(content, new Date("2026-01-01T00:00:00.000Z"));
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75); // 74 content + possibly SPACE prefix
    }
    // Ensure the content is present (not truncated)
    expect(ics).toContain("あ");
  });

  // C4: VTIMEZONE block present
  it("includes a VTIMEZONE block for Asia/Jakarta (C4)", () => {
    const ics = buildWeddingCalendarIcs(
      weddingContent,
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:Asia/Jakarta");
    expect(ics).toContain("TZOFFSETTO:+0700");
    expect(ics).toContain("END:VTIMEZONE");
    // VTIMEZONE must appear before any VEVENT
    const tzPos = ics.indexOf("BEGIN:VTIMEZONE");
    const veventPos = ics.indexOf("BEGIN:VEVENT");
    expect(tzPos).toBeLessThan(veventPos);
  });

  // C5: normalizePhoneNumber validation
  describe("normalizePhoneNumber — garbage rejection (C5)", () => {
    it("returns a normalized phone number for valid input", () => {
      expect(normalizePhoneNumber("+62", "81234567890")).toBe("+62 81234567890");
      expect(normalizePhoneNumber("62", "81234567890")).toBe("+62 81234567890");
      // Leading zeros stripped from local number
      expect(normalizePhoneNumber("+62", "081234567890")).toBe("+62 81234567890");
    });

    it("throws when country code has no digits", () => {
      expect(() => normalizePhoneNumber("", "81234567890")).toThrow();
      expect(() => normalizePhoneNumber("+", "81234567890")).toThrow();
      expect(() => normalizePhoneNumber("abc", "81234567890")).toThrow();
    });

    it("throws when local number is empty after cleaning", () => {
      expect(() => normalizePhoneNumber("+62", "")).toThrow();
      expect(() => normalizePhoneNumber("+62", "abc")).toThrow();
      expect(() => normalizePhoneNumber("+62", "000")).toThrow(); // all zeros stripped
    });
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
    expect(email.html).toContain("Buddhist Wedding Ceremony");
  });
});
