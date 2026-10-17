import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSelfRegisteredInvitation,
  createSimpleRegisteredInvitation,
  deleteInvitationByAdmin,
  getDraftContent,
  getHistory,
  getInvitationByCode,
  getPublishedContent,
  publishDraftContent,
  saveDraftContent,
  submitRsvp,
} from "@/lib/data-store";
import {
  customPublicLinkCode,
  decodePublicLinkSlug,
  discoverMedanHref,
  invitationHref,
  publicInvitationHref,
  publicLinkPathProblem,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import {
  findPublicInviteTypeByPath,
  getDefaultPublicInviteType,
  getEffectiveRsvpDeadline,
  isSimplePublicInviteType,
  NO_RSVP_DEADLINE,
  resolvePublicLinkSlug,
  simpleRsvpSchema,
  toGuestContent,
  toLinkGuestContent,
  validateSelfRegistration,
} from "@/lib/rsvp";
import { buildSimpleRsvpEmail } from "@/lib/rsvp-confirmation-email";
import type {
  InvitationGroup,
  PublicInviteType,
  SelfRegistrationSubmission,
  WeddingContent,
} from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// SF-7: the simple RSVP form on a custom-address link. Nothing here depends
// on today's date (No deadline never closes; past dates are long past).
const SIMPLE: PublicInviteType = {
  id: "custom-jessmarried-simple",
  label: { en: "Medan friends", id: "Sahabat Medan" },
  code: "JESSMARRIED-SIMPLE",
  flow: "generic",
  maxGuests: 2,
  requireGuestNames: false,
  isEnabled: true,
  form: "simple",
  path: "JESSmarriED",
  rsvpDeadline: NO_RSVP_DEADLINE,
};

const generic = getDefaultPublicInviteType(weddingContent);

function withLinks(...links: PublicInviteType[]): WeddingContent {
  return {
    ...weddingContent,
    publicInviteTypes: [...weddingContent.publicInviteTypes, ...links],
  };
}

describe("simple link in stored content (SF-1)", () => {
  let originalDraft: WeddingContent;

  beforeAll(async () => {
    originalDraft = await getDraftContent();
  });

  afterAll(async () => {
    await saveDraftContent(originalDraft);
    await publishDraftContent();
  });

  it("keeps form and path through save and publish, and drops invalid, reserved and duplicate paths", async () => {
    const draft = await getDraftContent();
    const link = (id: string, extra: Record<string, unknown>) =>
      ({
        ...SIMPLE,
        id,
        code: id.toUpperCase(),
        form: undefined,
        path: undefined,
        ...extra,
      }) as PublicInviteType;
    const saved = await saveDraftContent({
      ...draft,
      publicInviteTypes: [
        ...draft.publicInviteTypes,
        { ...SIMPLE, path: " JESSmarriED " },
        // Case-sensitive: these are not the built-in routes they resemble.
        link("upper-admin", { path: "Admin" }),
        link("odd-form", { form: "SIMPLE" }),
        link("fancy-form", { form: "fancy" }),
        link("too-short", { path: "a" }),
        link("leading-dash", { path: "-medan" }),
        link("with-space", { path: "medan friends" }),
        link("with-slash", { path: "medan/friends" }),
        link("too-long", { path: "m".repeat(42) }),
        link("reserved-admin", { path: "admin" }),
        link("reserved-route", { path: "jessmarried" }),
        link("reserved-guide", { path: "discover-medan" }),
        link("duplicate", { path: "JESSmarriED", form: "simple" }),
        link("longest", { path: `m${"-".repeat(40)}` }),
      ],
    });
    const byId = (id: string) =>
      saved.publicInviteTypes.find((inviteType) => inviteType.id === id)!;

    expect(byId(SIMPLE.id)).toMatchObject({ form: "simple", path: "JESSmarriED" });
    expect(byId("upper-admin").path).toBe("Admin");
    expect(byId("longest").path).toBe(`m${"-".repeat(40)}`);
    for (const id of ["odd-form", "fancy-form", "upper-admin"]) {
      expect(byId(id)).not.toHaveProperty("form");
    }
    for (const id of [
      "too-short",
      "leading-dash",
      "with-space",
      "with-slash",
      "too-long",
      "reserved-admin",
      "reserved-route",
      "reserved-guide",
    ]) {
      expect(byId(id), id).not.toHaveProperty("path");
    }
    // The first link keeps a custom address; a later duplicate loses it.
    expect(byId("duplicate")).not.toHaveProperty("path");
    expect(byId("duplicate").form).toBe("simple");
    // Built-in links are unchanged (standard form, no address).
    for (const id of ["generic", "family", "overseas"]) {
      expect(byId(id)).not.toHaveProperty("form");
      expect(byId(id)).not.toHaveProperty("path");
    }

    await publishDraftContent();
    const published = await getPublishedContent();
    expect(findPublicInviteTypeByPath(published, "JESSmarriED")?.id).toBe(SIMPLE.id);
    // DL-7: guest pages still get no link list.
    expect(toGuestContent(published, NO_RSVP_DEADLINE).publicInviteTypes).toEqual([]);
  });

  it("the path rule: 2-41 letters, digits or dashes; only exact built-in names are reserved", () => {
    expect(publicLinkPathProblem("JESSmarriED")).toBeNull();
    expect(publicLinkPathProblem("ADMIN")).toBeNull();
    expect(publicLinkPathProblem("ab")).toBeNull();
    expect(publicLinkPathProblem("a")).toBe("format");
    expect(publicLinkPathProblem("icon.svg")).toBe("format");
    expect(publicLinkPathProblem("-ab")).toBe("format");
    for (const reserved of [
      "admin",
      "api",
      "invite",
      "family",
      "overseas",
      "jessmarried",
      "go",
      "discover-medan",
      "travel-accommodation",
      "assets",
    ]) {
      expect(publicLinkPathProblem(reserved), reserved).toBe("reserved");
    }
  });
});

describe("root address resolution (SF-2)", () => {
  const content = withLinks(SIMPLE);

  it("an exact custom address wins; any other capitalisation keeps the code match", () => {
    expect(resolvePublicLinkSlug(content, "JESSmarriED")?.id).toBe(SIMPLE.id);
    expect(resolvePublicLinkSlug(content, "JESSMARRIED")?.id).toBe("generic");
    expect(resolvePublicLinkSlug(content, "jessmarried")?.id).toBe("generic");
    expect(resolvePublicLinkSlug(content, "JessMarried")?.id).toBe("generic");
    expect(resolvePublicLinkSlug(content, "jessmarriED")?.id).toBe("generic");
    // The simple link also keeps its code address.
    expect(resolvePublicLinkSlug(content, "jessmarried-simple")?.id).toBe(SIMPLE.id);
    expect(resolvePublicLinkSlug(content, "family-and-friends")).toBeUndefined();
  });

  it("a switched-off link's address falls back to the code match", () => {
    const off = withLinks({ ...SIMPLE, isEnabled: false });
    expect(findPublicInviteTypeByPath(off, "JESSmarriED")).toBeUndefined();
    expect(resolvePublicLinkSlug(off, "JESSmarriED")?.id).toBe("generic");
    expect(resolvePublicLinkSlug(off, "jessmarried-simple")).toBeUndefined();
  });

  it("without any custom address nothing changes", () => {
    for (const slug of ["JESSMARRIED", "JESSmarriED", "ejfamily", "EJOverseas"]) {
      expect(resolvePublicLinkSlug(weddingContent, slug)?.code).toBe(
        slug.toUpperCase(),
      );
    }
  });

  it("stray segments decode to nothing (404 before any read)", () => {
    expect(decodePublicLinkSlug("JESSmarriED")).toBe("JESSmarriED");
    expect(decodePublicLinkSlug("jessmarried-simple")).toBe("jessmarried-simple");
    for (const slug of ["favicon.ico", "robots.txt", "a%2Fb", "%E0%A4%A", "wp-login.php", "-x"]) {
      expect(decodePublicLinkSlug(slug), slug).toBe("");
    }
  });
});

describe("link page data (SF-3)", () => {
  it("a simple link's page gets no events (no names or times in the payload); a standard link's is unchanged", () => {
    const content = withLinks(SIMPLE);
    const simple = toLinkGuestContent(content, SIMPLE);
    expect(simple.events).toEqual([]);
    expect(simple.rsvpDeadline).toBe(NO_RSVP_DEADLINE);
    expect(simple.publicInviteTypes).toEqual([]);
    const payload = JSON.stringify(simple);
    for (const event of weddingContent.events) {
      expect(payload).not.toContain(`"${event.startTime}"`);
      expect(payload).not.toContain(event.title.en);
    }
    expect(toLinkGuestContent(content, generic)).toEqual(
      toGuestContent(content, getEffectiveRsvpDeadline(content, { inviteType: generic })),
    );
    expect(toLinkGuestContent(content, generic).events).toHaveLength(3);
  });
});

describe("navigation back to a custom address (SF-2)", () => {
  it("menus and back links use the custom address, not /invite/CODE or the code path", () => {
    const linkCode = customPublicLinkCode(SIMPLE);
    expect(linkCode).toBe("JESSMARRIED-SIMPLE");
    expect(invitationHref(undefined, "generic", linkCode, SIMPLE.path)).toBe("/JESSmarriED");
    expect(publicInvitationHref("generic", linkCode, SIMPLE.path)).toBe("/JESSmarriED");
    expect(discoverMedanHref(undefined, "generic", linkCode)).toBe(
      "/discover-medan?flow=generic&link=JESSMARRIED-SIMPLE",
    );
    expect(travelAccommodationHref(undefined, "generic", linkCode)).toBe(
      "/travel-accommodation?flow=generic&link=JESSMARRIED-SIMPLE",
    );
    // A personal code still wins.
    expect(invitationHref("ANATAN", "generic", linkCode, SIMPLE.path)).toBe(
      "/invite/ANATAN",
    );
  });

  it("links without a custom address keep today's routes", () => {
    expect(customPublicLinkCode(generic)).toBeUndefined();
    expect(invitationHref(undefined, "generic")).toBe("/jessmarried");
    expect(invitationHref(undefined, "generic", "FAMILY-AND-FRIENDS")).toBe(
      "/family-and-friends",
    );
    // A built-in link given an address carries it too.
    expect(customPublicLinkCode({ ...generic, path: "Medan" })).toBe("JESSMARRIED");
  });
});

describe("simple form fields (SF-4)", () => {
  const schema = simpleRsvpSchema(2);
  const valid = {
    accessCode: "JESSMARRIED-SIMPLE",
    name: "  Ana Tan ",
    phone: " +62 8123123123 ",
    email: " Ana.Tan@Example.com ",
    attending: true,
    guestCount: 2,
    dietary: " Vegetarian ",
    website: "",
    language: "id",
  };

  // The fields that failed (a field can fail more than one rule).
  function issuePaths(payload: Record<string, unknown>) {
    const result = schema.safeParse(payload);
    return result.success
      ? []
      : [...new Set(result.error.issues.map((issue) => issue.path[0]))];
  }

  it("trims what the guest typed and keeps the email as typed", () => {
    expect(schema.parse(valid)).toEqual({
      accessCode: "JESSMARRIED-SIMPLE",
      name: "Ana Tan",
      phone: "+62 8123123123",
      email: "Ana.Tan@Example.com",
      attending: true,
      guestCount: 2,
      dietary: "Vegetarian",
      website: "",
      language: "id",
    });
    expect(schema.parse({ ...valid, dietary: "   ", language: "fr" })).toMatchObject({
      dietary: undefined,
      language: "en",
    });
  });

  it("a No is always one person; a Yes is 1..the link's max", () => {
    expect(schema.parse({ ...valid, attending: false, guestCount: 9 }).guestCount).toBe(1);
    expect(schema.parse({ ...valid, attending: false, guestCount: "x" }).guestCount).toBe(1);
    expect(issuePaths({ ...valid, guestCount: 3 })).toEqual(["guestCount"]);
    expect(issuePaths({ ...valid, guestCount: 0 })).toEqual(["guestCount"]);
    expect(issuePaths({ ...valid, guestCount: 1.5 })).toEqual(["guestCount"]);
    expect(simpleRsvpSchema(1).safeParse({ ...valid, guestCount: 2 }).success).toBe(false);
  });

  it("refuses a blank name, a bad WhatsApp number, a loose email, a missing answer and a long note", () => {
    expect(issuePaths({ ...valid, name: "   " })).toEqual(["name"]);
    expect(issuePaths({ ...valid, name: "n".repeat(121) })).toEqual(["name"]);
    for (const phone of ["", "+62", "+62 81-23", "phone 123456", "1".repeat(31)]) {
      expect(issuePaths({ ...valid, phone }), phone).toEqual(["phone"]);
    }
    for (const email of ["", "ana", "ana@example", "a@b.com?bcc=x@y.com", "a b@c.com"]) {
      expect(issuePaths({ ...valid, email }), email).toEqual(["email"]);
    }
    expect(issuePaths({ ...valid, attending: undefined })).toEqual(["attending"]);
    expect(issuePaths({ ...valid, attending: "yes" })).toEqual(["attending"]);
    expect(issuePaths({ ...valid, dietary: "d".repeat(201) })).toEqual(["dietary"]);
  });

  it("only the literal form value counts as simple", () => {
    expect(isSimplePublicInviteType(SIMPLE)).toBe(true);
    expect(isSimplePublicInviteType(generic)).toBe(false);
    expect(isSimplePublicInviteType(undefined)).toBe(false);
  });
});

function simpleInvitation(overrides: Partial<InvitationGroup> = {}): InvitationGroup {
  return {
    id: "invite-simple-email",
    code: "ANATAN",
    greeting: "Dear Ana Tan",
    groupName: "Ana <b>Tan</b>",
    email: "ana@example.com",
    maxGuests: 2,
    side: "joint",
    source: "generic",
    flow: "generic",
    eligibleEvents: ["dinner"],
    rsvp: {
      id: "rsvp-simple-email",
      invitationGroupId: "invite-simple-email",
      status: "attending",
      eventAttendance: { dinner: true },
      message: "Dietary: Vegetarian",
    },
    guests: [
      { id: "g1", invitationGroupId: "invite-simple-email", name: "Ana", mealPreference: "unset" },
      { id: "g2", invitationGroupId: "invite-simple-email", name: "Ana Guest 2", mealPreference: "unset" },
    ],
    rsvpDeadline: NO_RSVP_DEADLINE,
    ...overrides,
  };
}

function expectNoEventDetails(html: string) {
  for (const event of weddingContent.events) {
    for (const title of [event.title.en, event.title.id, event.shortTitle.en, event.shortTitle.id]) {
      expect(html).not.toContain(title);
    }
    expect(html).not.toContain(event.startTime);
    expect(html).not.toContain(event.venueName);
  }
  expect(html).not.toMatch(/\d{1,2}:\d{2}/);
  expect(html).not.toMatch(/calendar|kalender|dinner|lunch|ceremony|resepsi/i);
  expect(html).not.toContain("/invite/");
  expect(html).not.toContain("ANATAN");
}

describe("simple confirmation email (SF-5)", () => {
  const content = { ...weddingContent, rsvpContact: { whatsappUrl: "https://wa.me/message/COSKSKIJH7AHP1" } };

  it("English: the date, the venue with its map link, the note and how to change it — no events, times, calendar or invite link", () => {
    const { subject, html } = buildSimpleRsvpEmail({
      content,
      invitation: simpleInvitation(),
      language: "en",
      dietary: "Vegetarian & <no nuts>",
    });
    expect(subject).toBe("Your RSVP for Edward & Jessica's wedding");
    expect(html).toContain("We received your RSVP");
    expect(html).toContain("Hi Ana &lt;b&gt;Tan&lt;/b&gt;,");
    expect(html).toContain("We&#39;ve received your RSVP for 2 people.");
    expect(html).toContain("Dietary requirements:</strong> Vegetarian &amp; &lt;no nuts&gt;");
    expect(html).toContain("Saturday, 12 December 2026");
    expect(html).toContain("Grand City Hall, Medan, Indonesia");
    expect(html).toContain(`<a href="${weddingContent.venue.mapsUrl}"`);
    expect(html).toContain("Open in Google Maps");
    expect(html).toContain(
      "To change anything, message Edward or Jessica on WhatsApp or Telegram.",
    );
    expect(html).toContain('href="https://wa.me/message/COSKSKIJH7AHP1"');
    expect(html).not.toContain("<no nuts>");
    expect(html).not.toContain("<b>Tan");
    expect(html).not.toContain("after our RSVP date");
    expectNoEventDetails(html);
  });

  it("Indonesian, one person, and a declined answer", () => {
    const one = buildSimpleRsvpEmail({
      content,
      invitation: simpleInvitation({ guests: simpleInvitation().guests.slice(0, 1) }),
      language: "id",
    });
    expect(one.subject).toBe("RSVP Anda untuk pernikahan Edward & Jessica");
    expect(one.html).toContain("Halo Ana &lt;b&gt;Tan&lt;/b&gt;,");
    expect(one.html).toContain("Kami telah menerima RSVP Anda untuk 1 orang.");
    expect(one.html).toContain("Sabtu, 12 Desember 2026");
    expect(one.html).toContain("Grand City Hall, Medan, Indonesia");
    expect(one.html).toContain("Buka di Google Maps");
    expect(one.html).toContain("Hubungi kami via WhatsApp");
    expect(one.html).toContain("Salam hangat,");
    expect(one.html).not.toContain("Kebutuhan makanan khusus");
    expectNoEventDetails(one.html);

    const declined = simpleInvitation({
      rsvp: { ...simpleInvitation().rsvp, status: "declined", eventAttendance: {}, message: undefined },
      guests: simpleInvitation().guests.slice(0, 1),
    });
    const en = buildSimpleRsvpEmail({ content, invitation: declined, language: "en" });
    expect(en.subject).toBe("We received your RSVP for Edward & Jessica's wedding");
    expect(en.html).toContain("Thank you for letting us know you can&#39;t make it — we&#39;ll miss you.");
    const id = buildSimpleRsvpEmail({ content, invitation: declined, language: "id", late: true });
    expect(id.subject).toBe("Kami telah menerima RSVP Anda untuk pernikahan Edward & Jessica");
    expect(id.html).toContain("kami akan merindukan Anda.");
    // A late decline needs no "we'll confirm your place".
    expect(id.html).not.toContain("memastikan tempat Anda");
    expectNoEventDetails(en.html);
    expectNoEventDetails(id.html);
  });

  it("a late Yes adds one sentence; no contact link without a WhatsApp contact", () => {
    const late = buildSimpleRsvpEmail({
      content: { ...weddingContent, rsvpContact: {} },
      invitation: simpleInvitation(),
      language: "en",
      late: true,
    });
    expect(late.html).toContain(
      "Since this came after our RSVP date, we&#39;ll confirm your place with you.",
    );
    expect(late.html).not.toContain("wa.me");
    expect(late.html).not.toContain("Message us on WhatsApp");
  });
});

describe("simple registrations in the store (SF-4)", () => {
  it("Yes: dinner only, every meal unset, the dietary note, the link's No deadline and a simple-form note", async () => {
    const { invitation, existing } = await createSimpleRegisteredInvitation(
      {
        accessCode: "JESSMARRIED-SIMPLE",
        name: "Simple Store Guest",
        phone: "+62 8123123123",
        email: "Simple.Store@Example.com",
        attending: true,
        guestCount: 2,
        dietary: "Vegetarian",
        language: "en",
      },
      SIMPLE,
    );
    try {
      expect(existing).toBe(false);
      expect(invitation).toMatchObject({
        greeting: "Dear Simple Store Guest",
        groupName: "Simple Store Guest",
        email: "Simple.Store@Example.com",
        phone: "+62 8123123123",
        maxGuests: 2,
        side: "joint",
        source: "generic",
        flow: "generic",
        eligibleEvents: ["dinner"],
        rsvpDeadline: NO_RSVP_DEADLINE,
        privateNotes: {
          en: "Registered through the simple form (/JESSmarriED).",
          id: "Mendaftar melalui formulir sederhana (/JESSmarriED).",
        },
        rsvp: {
          status: "attending",
          eventAttendance: { dinner: true },
          message: "Dietary: Vegetarian",
          updatedBy: "guest",
        },
      });
      expect(
        invitation.guests.map((guest) => [guest.name, guest.mealPreference]),
      ).toEqual([
        ["Simple Store Guest", "unset"],
        ["Simple Store Guest Guest 2", "unset"],
      ]);
      expect(await getInvitationByCode(invitation.code)).toEqual(invitation);
      const [latest] = await getHistory();
      expect(latest).toMatchObject({
        invitationGroupId: invitation.id,
        status: "attending",
        changedBy: "guest",
      });
    } finally {
      await deleteInvitationByAdmin(invitation.code);
    }
  });

  it("No: one guest, no events and no note", async () => {
    const { invitation } = await createSimpleRegisteredInvitation(
      {
        accessCode: "JESSMARRIED-SIMPLE",
        name: "Simple Declined Guest",
        phone: "+62 8123123124",
        email: "simple.declined@example.com",
        attending: false,
        guestCount: 1,
        language: "id",
      },
      { ...SIMPLE, path: undefined, rsvpDeadline: undefined },
    );
    try {
      expect(invitation.rsvp).toMatchObject({ status: "declined", eventAttendance: {} });
      expect(invitation.rsvp.message).toBeUndefined();
      expect(invitation.guests).toHaveLength(1);
      expect(invitation.guests[0].mealPreference).toBe("unset");
      expect(invitation).not.toHaveProperty("rsvpDeadline");
      // Without a custom address the note names the code's short path.
      expect(invitation.privateNotes?.en).toBe(
        "Registered through the simple form (/jessmarried-simple).",
      );
    } finally {
      await deleteInvitationByAdmin(invitation.code);
    }
  });
});

describe("B12 meal rule stays for the standard form (SF-4 regression)", () => {
  const standard: SelfRegistrationSubmission = {
    accessCode: "JESSMARRIED",
    email: "standard.meal@example.com",
    name: "Standard Meal Guest",
    phone: "+628111222",
    guestCount: 1,
    mealPreference: "vegetarian",
    status: "attending",
    eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
  };

  it("the standard registration payload must choose a meal", () => {
    expect(() => validateSelfRegistration({ ...standard, mealPreference: undefined })).toThrow();
    expect(() => validateSelfRegistration({ ...standard, mealPreference: "unset" })).toThrow();
    expect(validateSelfRegistration(standard).mealPreference).toBe("vegetarian");
  });

  it("a standard registration saved without a meal is refused (only the simple form saves unset meals)", async () => {
    await expect(
      createSelfRegisteredInvitation(
        { ...standard, mealPreference: "unset" as never },
        generic,
      ),
    ).rejects.toThrow("Please select a meal preference for every guest attending.");
    await expect(
      createSelfRegisteredInvitation(
        { ...standard, mealPreference: undefined as never },
        generic,
      ),
    ).rejects.toThrow("Please select a meal preference for every guest attending.");
    // A standard decline still needs no meal.
    const declined = await createSelfRegisteredInvitation(
      { ...standard, status: "declined", eventAttendance: {}, mealPreference: "unset" as never },
      generic,
    );
    try {
      expect(declined.rsvp.status).toBe("declined");
    } finally {
      await deleteInvitationByAdmin(declined.code);
    }
  });

  it("a personal-invite RSVP still needs every attending guest's meal", async () => {
    await expect(
      submitRsvp({
        code: "EJ26-HARDWIN",
        status: "attending",
        eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
        mealPreferences: {},
      }),
    ).rejects.toThrow("Please select a meal preference for every guest attending.");
  });
});
