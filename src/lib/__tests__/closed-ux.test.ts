import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getDraftContent,
  getPublishedContent,
  publishDraftContent,
  saveDraftContent,
} from "@/lib/data-store";
import { guestCountHintText, rsvpCountdownText } from "@/lib/i18n";
import {
  getRsvpDaysLeft,
  hasRsvpContact,
  isRsvpClosed,
  normalizeContactEmail,
  normalizeRsvpContact,
  normalizeWhatsAppUrl,
  toGuestContent,
  toGuestInvitation,
} from "@/lib/rsvp";
import { sampleInvitations } from "@/lib/seed";
import type { WeddingContent } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// CL-12: closed-state UX helpers (Slice 2).
const OWNER_WHATSAPP = "https://wa.me/message/COSKSKIJH7AHP1";
const NOV_3 = "2026-11-03T16:59:59.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("RSVP contact validation (CL-3)", () => {
  it("keeps a https WhatsApp link verbatim and turns phone numbers into wa.me links", () => {
    expect(normalizeWhatsAppUrl(OWNER_WHATSAPP)).toBe(OWNER_WHATSAPP);
    expect(normalizeWhatsAppUrl(`  ${OWNER_WHATSAPP}  `)).toBe(OWNER_WHATSAPP);
    expect(
      normalizeWhatsAppUrl("https://api.whatsapp.com/send?phone=6281234567890"),
    ).toBe("https://api.whatsapp.com/send?phone=6281234567890");
    expect(normalizeWhatsAppUrl("https://whatsapp.com/channel/abc")).toBe(
      "https://whatsapp.com/channel/abc",
    );
    expect(normalizeWhatsAppUrl("+6281234567890")).toBe(
      "https://wa.me/6281234567890",
    );
    expect(normalizeWhatsAppUrl("+62 812-3456-7890")).toBe(
      "https://wa.me/6281234567890",
    );
  });

  it("rejects non-https, script, look-alike hosts, credentials and local numbers", () => {
    for (const value of [
      "",
      "   ",
      "http://wa.me/6281234567890",
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://evil.example/wa.me/6281234567890",
      "https://wa.me.evil.example/6281234567890",
      "https://user:pass@wa.me/6281234567890",
      "wa.me/6281234567890",
      "081234567890",
      "12345",
      "not a link",
      42,
      null,
      undefined,
    ]) {
      expect(normalizeWhatsAppUrl(value), String(value)).toBeUndefined();
    }
  });

  it("trims a valid email and rejects anything else", () => {
    expect(normalizeContactEmail("  test@example.com ")).toBe("test@example.com");
    expect(normalizeContactEmail("edward.moktar+rsvp@mail.example.co.id")).toBe(
      "edward.moktar+rsvp@mail.example.co.id",
    );
    for (const value of ["", "test", "test@", "a b@example.com", "x@y", "<a@b.co>", 1]) {
      expect(normalizeContactEmail(value), String(value)).toBeUndefined();
    }
  });

  it("rejects emails that would add mailto: header fields or other URL parts", () => {
    for (const value of [
      "a@b.co?bcc=x%40y.z",
      "test@example.com?bcc=attacker%40evil.com&subject=x&body=Visit%20http%3A%2F%2Fevil.example",
      "a@b.co%0D%0Ax",
      "test@example.com%0D%0ABcc%3Aevil%40x.com",
      "a@b.co#x",
      "a@b.c/../x",
      "a@b.co&cc=x@y.z",
      "a=b@c.co",
      "a\\b@c.co",
      "a@b.co\nBcc: x@y.z",
    ]) {
      expect(normalizeContactEmail(value), value).toBeUndefined();
    }
    expect(
      normalizeRsvpContact({ email: "test@example.com?bcc=attacker%40evil.com" }),
    ).toEqual({});
  });

  it("normalizeRsvpContact keeps valid fields and returns {} when nothing is valid", () => {
    expect(
      normalizeRsvpContact({
        whatsappUrl: "+6281234567890",
        email: " test@example.com ",
      }),
    ).toEqual({
      whatsappUrl: "https://wa.me/6281234567890",
      email: "test@example.com",
    });
    expect(
      normalizeRsvpContact({ whatsappUrl: "javascript:alert(1)", email: "nope" }),
    ).toEqual({});
    expect(normalizeRsvpContact({})).toEqual({});
    expect(normalizeRsvpContact(null)).toEqual({});
    expect(normalizeRsvpContact("https://wa.me/1")).toEqual({});
    expect(hasRsvpContact({})).toBe(false);
    expect(hasRsvpContact({ email: "test@example.com" })).toBe(true);
  });

  it("code default is the owner's wa.me short link and toGuestContent keeps it", () => {
    expect(weddingContent.rsvpContact).toEqual({ whatsappUrl: OWNER_WHATSAPP });
    const guest = toGuestContent(weddingContent, NOV_3);
    expect(guest.rsvpContact).toEqual({ whatsappUrl: OWNER_WHATSAPP });
    expect(guest.publicInviteTypes).toEqual([]);
  });
});

describe("RSVP contact in stored content (CL-3)", () => {
  let originalDraft: WeddingContent;

  beforeAll(async () => {
    originalDraft = await getDraftContent();
  });

  afterAll(async () => {
    await saveDraftContent(originalDraft);
    await publishDraftContent();
  });

  it("stored content without an rsvpContact key inherits the code default", async () => {
    const store = (
      globalThis as typeof globalThis & {
        __ejPreviewStore?: { content: Partial<WeddingContent> };
      }
    ).__ejPreviewStore;
    expect(store).toBeDefined();
    const published = store!.content;
    const saved = published.rsvpContact;
    delete published.rsvpContact;
    try {
      expect("rsvpContact" in published).toBe(false);
      expect((await getPublishedContent()).rsvpContact).toEqual({
        whatsappUrl: OWNER_WHATSAPP,
      });
    } finally {
      published.rsvpContact = saved;
    }

    // A draft PUT without the key is saved with the default as well.
    const withoutKey: Partial<WeddingContent> = { ...originalDraft };
    delete withoutKey.rsvpContact;
    const savedDraft = await saveDraftContent(withoutKey as WeddingContent);
    expect(savedDraft.rsvpContact).toEqual({ whatsappUrl: OWNER_WHATSAPP });
  });

  it("normalizes a phone number on save and keeps the owner link verbatim through publish", async () => {
    const phoneDraft = await saveDraftContent({
      ...originalDraft,
      rsvpContact: { whatsappUrl: "+62 812 3456 7890", email: "test@example.com" },
    });
    expect(phoneDraft.rsvpContact).toEqual({
      whatsappUrl: "https://wa.me/6281234567890",
      email: "test@example.com",
    });

    await saveDraftContent({
      ...originalDraft,
      rsvpContact: { whatsappUrl: OWNER_WHATSAPP, email: "test@example.com" },
    });
    const published = await publishDraftContent();
    expect(published.rsvpContact).toEqual({
      whatsappUrl: OWNER_WHATSAPP,
      email: "test@example.com",
    });
    expect((await getPublishedContent()).rsvpContact?.whatsappUrl).toBe(
      OWNER_WHATSAPP,
    );
  });

  it("an explicitly cleared contact stays cleared after save + publish (no default fallback)", async () => {
    const cleared = await saveDraftContent({ ...originalDraft, rsvpContact: {} });
    expect(cleared.rsvpContact).toEqual({});
    await publishDraftContent();
    // Round-trip through JSON, as the admin dashboard sends it.
    const roundTrip = JSON.parse(
      JSON.stringify(await getDraftContent()),
    ) as WeddingContent;
    expect(roundTrip.rsvpContact).toEqual({});
    await saveDraftContent(roundTrip);
    await publishDraftContent();
    expect((await getPublishedContent()).rsvpContact).toEqual({});
    expect((await getDraftContent()).rsvpContact).toEqual({});

    // Invalid values are dropped, which also leaves the contact cleared.
    const invalid = await saveDraftContent({
      ...originalDraft,
      rsvpContact: { whatsappUrl: "javascript:alert(1)", email: "nope" },
    });
    expect(invalid.rsvpContact).toEqual({});
  });
});

describe("RSVP countdown (CL-8)", () => {
  it("hides the countdown exactly when RSVP closes (no gap at the deadline)", () => {
    const deadline = new Date(NOV_3).getTime();
    for (const offset of [-DAY_MS, -1000, -1, 0, 1, 1000, DAY_MS]) {
      const now = new Date(deadline + offset);
      expect(getRsvpDaysLeft(NOV_3, now) === null, String(offset)).toBe(
        isRsvpClosed(NOV_3, now),
      );
    }
    // At the deadline instant RSVP is still open, so the countdown shows 1.
    expect(getRsvpDaysLeft(NOV_3, new Date(deadline))).toBe(1);
    expect(getRsvpDaysLeft(NOV_3, new Date(deadline + 1))).toBeNull();
  });

  it("rounds days up and never shows 0", () => {
    const deadline = new Date(NOV_3).getTime();
    expect(getRsvpDaysLeft(NOV_3, new Date(deadline - 1))).toBe(1);
    expect(getRsvpDaysLeft(NOV_3, new Date(deadline - DAY_MS))).toBe(1);
    expect(getRsvpDaysLeft(NOV_3, new Date(deadline - DAY_MS - 1))).toBe(2);
    expect(getRsvpDaysLeft("not a date", new Date(deadline))).toBeNull();
  });

  it("uses the singular for 1 day and keeps the 14-day urgent wording", () => {
    expect(rsvpCountdownText("en", 1)).toBe("RSVP closes soon — 1 day left");
    expect(rsvpCountdownText("en", 2)).toBe("RSVP closes soon — 2 days left");
    expect(rsvpCountdownText("en", 14)).toBe("RSVP closes soon — 14 days left");
    expect(rsvpCountdownText("en", 15)).toBe("15 days left to RSVP");
    expect(rsvpCountdownText("id", 1)).toBe("RSVP segera ditutup — 1 hari lagi");
    expect(rsvpCountdownText("id", 9)).toBe("RSVP segera ditutup — 9 hari lagi");
    expect(rsvpCountdownText("id", 30)).toBe("30 hari lagi untuk RSVP");
  });
});

describe("guest-count note", () => {
  it("uses the singular for 1 guest and keeps the plural template", () => {
    expect(guestCountHintText("en", 1)).toBe("This link is for 1 guest.");
    expect(guestCountHintText("en", 2)).toBe("This link allows up to 2 guests.");
    expect(guestCountHintText("id", 1)).toBe(
      "Tautan ini berlaku untuk maksimal 1 tamu.",
    );
    expect(guestCountHintText("id", 4)).toBe(
      "Tautan ini berlaku untuk maksimal 4 tamu.",
    );
  });
});

describe("guest invitation allowlist (CL-11)", () => {
  it("drops email, phone and privateNotes and keeps what guest pages need", () => {
    const hardwin = sampleInvitations.find((item) => item.code === "EJ26-HARDWIN")!;
    expect(hardwin.email).toBeTruthy();
    expect(hardwin.phone).toBeTruthy();
    const guest = toGuestInvitation({
      ...hardwin,
      rsvpDeadline: NOV_3,
      travelOverrides: { transportProvided: false },
    });
    expect(Object.keys(guest)).not.toContain("email");
    expect(Object.keys(guest)).not.toContain("phone");
    expect(Object.keys(guest)).not.toContain("privateNotes");
    const json = JSON.stringify(guest);
    expect(json).not.toContain(hardwin.email!);
    expect(json).not.toContain(hardwin.phone!);
    expect(json).not.toContain(hardwin.privateNotes!.en);
    expect(guest.emailClaimed).toBe(true);
    expect(guest.code).toBe("EJ26-HARDWIN");
    expect(guest.flow).toBe("family");
    expect(guest.rsvp.status).toBe("pending");
    expect(guest.guests).toHaveLength(2);
    expect(guest.rsvpDeadline).toBe(NOV_3);
    expect(guest.travelOverrides).toEqual({ transportProvided: false });
  });
});
