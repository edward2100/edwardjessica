import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// PL-7: personal links (/JESSmarriED-2295A3FMJQWX). The real preview store holds the
// published simple link and the imported invitations; only the language
// cookie and Resend's fetch are stubbed. Time-independent: No deadline never
// closes and 2020 is long past.
vi.mock("@/lib/language-preference-server", () => ({
  getLanguagePreference: async () => null,
}));

import { POST } from "@/app/api/rsvp/personal/route";
import SlugPage from "@/app/[slug]/page";
import InviteCodePage from "@/app/invite/[code]/page";
import { invitationToDraft } from "@/lib/admin-drafts";
import { parseGuestCsv } from "@/lib/csv";
import {
  deleteInvitationByAdmin,
  getAdminSnapshot,
  getDraftContent,
  getInvitationByCode,
  publishDraftContent,
  saveDraftContent,
  upsertInvitationByAdmin,
  upsertInvitationFromCsvRows,
} from "@/lib/data-store";
import {
  buildAdminWhatsAppMessage,
  findPersonalLinkByCode,
  generatePersonalLinkCode,
  invitationPath,
  NO_RSVP_DEADLINE,
  personalLinkPath,
  personalRsvpSchema,
  resolvePersonalLinkSlug,
  simpleRsvpSchema,
  toPersonalInvite,
} from "@/lib/rsvp";
import type { PersonalInvite, PublicInviteType, WeddingContent } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

const PAST = "2020-01-01T16:59:59.000Z";
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

function contentWith(...links: PublicInviteType[]): WeddingContent {
  return {
    ...weddingContent,
    publicInviteTypes: [...weddingContent.publicInviteTypes, ...links],
  };
}

describe("personal link addresses (PL-1)", () => {
  const content = contentWith(SIMPLE);

  it("/JESSmarriED-2295A3FMJQWX opens invitation JESSMARRIED-2295A3FMJQWX on the simple link, in any case", () => {
    for (const slug of ["JESSmarriED-2295A3FMJQWX", "jessmarried-2295a3fmjqwx", "JESSMARRIED-2295A3FMJQWX"]) {
      expect(resolvePersonalLinkSlug(content, slug)).toEqual({
        link: SIMPLE,
        code: "JESSMARRIED-2295A3FMJQWX",
      });
    }
    expect(findPersonalLinkByCode(content, "jessmarried-7788bcdefghj")).toBe(SIMPLE);
    expect(personalLinkPath(SIMPLE, "jessmarried-2295a3fmjqwx")).toBe("/JESSmarriED-2295A3FMJQWX");
  });

  it("is exactly 12 letters or digits after an enabled simple link's own address (PL-8)", () => {
    for (const slug of [
      "JESSmarriED",
      "JESSmarriED-",
      "JESSmarriED-4821",
      "JESSmarriED-48a1",
      "JESSmarriED-SIMPLE",
      "JESSmarriED-2295A3FMJQW",
      "JESSmarriED-2295A3FMJQWXY",
      "JESSmarriED-2295A3FM-QWX",
      "EJ26-BRILIAN",
      "family-2295A3FMJQWX",
    ]) {
      expect(resolvePersonalLinkSlug(content, slug)).toBeUndefined();
    }
    // A link that is switched off, standard, or has no custom address owns
    // no personal links.
    for (const link of [
      { ...SIMPLE, isEnabled: false },
      { ...SIMPLE, form: undefined },
      { ...SIMPLE, path: undefined },
    ]) {
      expect(
        resolvePersonalLinkSlug(contentWith(link), "JESSmarriED-2295A3FMJQWX"),
      ).toBeUndefined();
    }
  });
});

describe("personal RSVP rules (PL-3, PL-4)", () => {
  const yes = {
    code: "JESSMARRIED-2295A3FMJQWX",
    attending: true,
    guestCount: 2,
    guestNames: ["Bp. Hadi", "Istri"],
    dietary: "",
    email: "",
    website: "",
    language: "id",
  };

  function issues(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
    return result.success ? [] : result.error!.issues.map((issue) => [issue.path.join("."), issue.message]);
  }

  it("a Yes needs a name for everyone, up to the invitation's size", () => {
    expect(personalRsvpSchema(2).parse(yes)).toMatchObject({
      guestCount: 2,
      guestNames: ["Bp. Hadi", "Istri"],
      email: undefined,
      dietary: undefined,
      language: "id",
    });
    expect(issues(personalRsvpSchema(2).safeParse({ ...yes, guestNames: ["Bp. Hadi", "  "] }))).toEqual([
      ["guestNames.1", "Please enter guest 2's name."],
    ]);
    expect(issues(personalRsvpSchema(2).safeParse({ ...yes, guestNames: [] }))).toEqual([
      ["guestNames.0", "Please enter guest 1's name."],
      ["guestNames.1", "Please enter guest 2's name."],
    ]);
    expect(personalRsvpSchema(1).safeParse(yes).success).toBe(false);
  });

  it("a No is one answer for the whole party: no names, count 1", () => {
    expect(
      personalRsvpSchema(2).parse({ ...yes, attending: false, guestCount: 2, guestNames: [] }),
    ).toMatchObject({ attending: false, guestCount: 1 });
  });

  it("the email is optional, but a typed one must be one plain address", () => {
    expect(personalRsvpSchema(2).parse({ ...yes, email: " Hadi@Example.com " }).email).toBe(
      "Hadi@Example.com",
    );
    expect(issues(personalRsvpSchema(2).safeParse({ ...yes, email: "a@b.com?bcc=x@y.com" }))).toEqual([
      ["email", "Please enter a valid email address."],
    ]);
  });

  it("the simple link asks for guest 2's name too, but still takes older pages that send none", () => {
    const link = {
      accessCode: "JESSMARRIED-SIMPLE",
      name: "Ana Tan",
      phone: "+62 8123123123",
      email: "ana@example.com",
      attending: true,
      guestCount: 2,
      language: "en",
    };
    expect(issues(simpleRsvpSchema(2).safeParse({ ...link, guestNames: ["Ana Tan", ""] }))).toEqual([
      ["guestNames.1", "Please enter guest 2's name."],
    ]);
    expect(simpleRsvpSchema(2).safeParse({ ...link, guestNames: ["Ana Tan", "Budi"] }).success).toBe(true);
    expect(simpleRsvpSchema(2).safeParse(link).success).toBe(true);
  });
});

// One personal link per group; two groups may share a name.
const CSV = [
  "groupName,greeting,name,phone,maxGuests,side,flow,events,privateNotesEn,code,note",
  "Bp. Hadi & Istri,Dear Bp. Hadi & Istri,Bp. Hadi,+628120000001,2,groom,generic,dinner,Group: Neighbours,JESSMARRIED-2295A3FMJQWX,",
  "Bp. Hadi & Istri,Dear Bp. Hadi & Istri,Istri,+628120000001,2,groom,generic,dinner,Group: Neighbours,JESSMARRIED-2295A3FMJQWX,",
  "Bp. Slamet & Istri,Dear Bp. Slamet & Istri,Bp. Slamet,+628120000002,2,groom,generic,dinner,Group: Tennis,JESSMARRIED-5317KPRTVXYZ,Dietary: 2 vegetarian",
  "Bp. Slamet & Istri,Dear Bp. Slamet & Istri,Istri,+628120000002,2,groom,generic,dinner,Group: Tennis,JESSMARRIED-5317KPRTVXYZ,",
  "Bp. Slamet & Istri,Dear Bp. Slamet & Istri,Bp. Slamet,+628120000003,2,groom,generic,dinner,Group: Office,JESSMARRIED-6402HJMNQSTW,",
  "Pak Joko,Dear Pak Joko,Pak Joko,,2,groom,generic,dinner,Group: Campus,JESSMARRIED-7788BCDEFGHJ,",
].join("\n");
const CODES = ["JESSMARRIED-2295A3FMJQWX", "JESSMARRIED-5317KPRTVXYZ", "JESSMARRIED-6402HJMNQSTW", "JESSMARRIED-7788BCDEFGHJ"];

let originalDraft: WeddingContent;

beforeAll(async () => {
  originalDraft = await getDraftContent();
  await saveDraftContent({
    ...originalDraft,
    publicInviteTypes: [...originalDraft.publicInviteTypes, SIMPLE],
  });
  await publishDraftContent();
  const { rowErrors } = await upsertInvitationFromCsvRows(parseGuestCsv(CSV));
  expect(rowErrors).toEqual([]);
});

afterAll(async () => {
  for (const code of CODES) await deleteInvitationByAdmin(code);
  await saveDraftContent(originalDraft);
  await publishDraftContent();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("importing personal links (PL-5)", () => {
  it("keeps each code exactly, groups rows by code, and starts pending with the link's deadline", async () => {
    const hadi = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!;
    expect(hadi).toMatchObject({
      groupName: "Bp. Hadi & Istri",
      greeting: "Dear Bp. Hadi & Istri",
      maxGuests: 2,
      side: "groom",
      source: "admin",
      flow: "generic",
      eligibleEvents: ["dinner"],
      rsvpDeadline: NO_RSVP_DEADLINE,
      rsvp: { status: "pending" },
    });
    expect(hadi.guests.map((guest) => guest.name)).toEqual(["Bp. Hadi", "Istri"]);
    // Same name, two codes: two invitations.
    const tennis = (await getInvitationByCode("JESSMARRIED-5317KPRTVXYZ"))!;
    const office = (await getInvitationByCode("JESSMARRIED-6402HJMNQSTW"))!;
    expect(tennis.guests).toHaveLength(2);
    expect(office.guests.map((guest) => guest.name)).toEqual(["Bp. Slamet"]);
    expect(tennis.id).not.toBe(office.id);
    // The note column becomes the RSVP note, shown to the guest as dietary.
    expect(tennis.rsvp.message).toBe("Dietary: 2 vegetarian");
    expect(toPersonalInvite(tennis).dietary).toBe("2 vegetarian");
    // One name, two seats: one guest now, room for a second.
    const joko = (await getInvitationByCode("JESSMARRIED-7788BCDEFGHJ"))!;
    expect(joko.guests.map((guest) => guest.name)).toEqual(["Pak Joko"]);
    expect(joko.maxGuests).toBe(2);
  });

  it("refuses a code that is already used instead of changing it", async () => {
    const { created, rowErrors } = await upsertInvitationFromCsvRows(
      parseGuestCsv(CSV.split("\n").slice(0, 2).join("\n")),
    );
    expect(created).toEqual([]);
    expect(rowErrors).toEqual([
      { groupName: "Bp. Hadi & Istri", message: "Code JESSMARRIED-2295A3FMJQWX is already used." },
    ]);
  });

  it("refuses a malformed code", () => {
    expect(() =>
      parseGuestCsv("groupName,name,code\nAna,Ana,JESS MARRIED!"),
    ).toThrow('"JESS MARRIED!" is not a valid invite code.');
  });

  it("only the guest-safe fields reach the page", async () => {
    const invite = toPersonalInvite((await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!);
    expect(invite).toEqual({
      code: "JESSMARRIED-2295A3FMJQWX",
      displayName: "Bp. Hadi & Istri",
      guestNames: ["Bp. Hadi", "Istri"],
      maxGuests: 2,
      status: "pending",
      dietary: "",
    });
    expect(JSON.stringify(invite)).not.toContain("628120000001");
    expect(JSON.stringify(invite)).not.toContain("Group:");
  });
});

// PL-8: 12 random characters, no 0/O or 1/I/L.
const RANDOM_CODE = /^JESSMARRIED-[2-9A-HJKMNP-Z]{12}$/;

describe("admin makes personal links (PL-8)", () => {
  it("each new code is 12 random characters on the link's address", () => {
    const codes = new Set(Array.from({ length: 300 }, () => generatePersonalLinkCode(SIMPLE)));
    expect(codes.size).toBe(300);
    for (const code of codes) {
      expect(code).toMatch(RANDOM_CODE);
      expect(findPersonalLinkByCode(contentWith(SIMPLE), code)).toBe(SIMPLE);
    }
  });

  it("a CSV link column gives each group its own personal link, simple form and dinner only", async () => {
    const { created, rowErrors } = await upsertInvitationFromCsvRows(
      parseGuestCsv(
        [
          "groupName,greeting,name,maxGuests,side,flow,events,link",
          "Bp. Yanto & Istri,Kepada Yth. Bp. Yanto & Istri,Bp. Yanto,2,groom,family,holy_matrimony|dinner,/jessmarried",
          "Bp. Yanto & Istri,Kepada Yth. Bp. Yanto & Istri,Istri,2,groom,family,holy_matrimony|dinner,/jessmarried",
          "Ibu Rina,Kepada Yth. Ibu Rina,Ibu Rina,1,groom,generic,dinner,JESSmarriED",
          "Bp. Dedi & Istri,Kepada Yth. Bp. Dedi & Istri,Bp. Dedi,2,groom,generic,dinner,family",
        ].join("\n"),
      ),
    );
    try {
      expect(rowErrors).toEqual([
        { groupName: "Bp. Dedi & Istri", message: "No published simple-form link at /family." },
      ]);
      expect(created.map((group) => group.groupName)).toEqual(["Bp. Yanto & Istri", "Ibu Rina"]);
      const [yanto, rina] = created;
      expect(yanto.code).toMatch(RANDOM_CODE);
      expect(rina.code).toMatch(RANDOM_CODE);
      expect(yanto.code).not.toBe(rina.code);
      const saved = (await getInvitationByCode(yanto.code))!;
      expect(saved).toMatchObject({
        flow: "generic",
        eligibleEvents: ["dinner"],
        rsvpDeadline: NO_RSVP_DEADLINE,
        rsvp: { status: "pending" },
      });
      expect(saved.guests.map((guest) => guest.name)).toEqual(["Bp. Yanto", "Istri"]);
    } finally {
      for (const group of created) await deleteInvitationByAdmin(group.code);
    }
  });

  it("New Group can make one, with the link's deadline unless one is set", async () => {
    const base = {
      groupName: "Ibu Sari",
      greeting: "Kepada Yth. Ibu Sari",
      maxGuests: 1,
      side: "groom" as const,
      flow: "family" as const,
      eligibleEvents: ["holy_matrimony" as const, "dinner" as const],
      guests: [{ name: "Ibu Sari", mealPreference: "unset" as const }],
      personalLinkId: SIMPLE.id,
    };
    const made = await upsertInvitationByAdmin(base);
    const extended = await upsertInvitationByAdmin({
      ...base,
      groupName: "Bp. Bambang",
      rsvpDeadline: "2026-11-30T16:59:00.000Z",
    });
    try {
      expect(made.code).toMatch(RANDOM_CODE);
      expect(made).toMatchObject({
        source: "admin",
        flow: "generic",
        eligibleEvents: ["dinner"],
        rsvpDeadline: NO_RSVP_DEADLINE,
      });
      expect(extended.code).toMatch(RANDOM_CODE);
      expect(extended.rsvpDeadline).toBe("2026-11-30T16:59:00.000Z");
      // Saving an existing group keeps its code; the choice is for new ones.
      const edited = await upsertInvitationByAdmin({
        ...invitationToDraft(made),
        phone: "+628120000004",
        personalLinkId: SIMPLE.id,
      });
      expect(edited.code).toBe(made.code);
      expect(edited.phone).toBe("+628120000004");
      // Only a link with personal links can make them.
      await expect(
        upsertInvitationByAdmin({ ...base, personalLinkId: "family" }),
      ).rejects.toThrow("That link can't have personal links");
    } finally {
      await deleteInvitationByAdmin(made.code);
      await deleteInvitationByAdmin(extended.code);
    }
  });

  it("admin's links and WhatsApp invitation use the personal address, in Indonesian", async () => {
    const content = contentWith(SIMPLE);
    const hadi = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!;
    expect(invitationPath(content, hadi.code)).toBe("/JESSmarriED-2295A3FMJQWX");
    expect(invitationPath(content, "EJ26-BRILIAN-AB12C")).toBe("/invite/EJ26-BRILIAN-AB12C");
    expect(
      buildAdminWhatsAppMessage({
        invitation: hadi,
        content,
        messageType: "invitation",
        baseUrl: "https://rsvp.edwardjessica.com/",
      }),
    ).toBe(
      [
        "Kepada Yth.",
        "Bp. Hadi & Istri",
        "",
        "Dengan penuh sukacita, kami mengundang Bapak/Ibu untuk hadir di resepsi pernikahan Edward & Jessica:",
        "",
        "Sabtu, 12 Desember 2026",
        "Grand City Hall Medan",
        "",
        "Mohon konfirmasi kehadiran Bapak/Ibu melalui tautan berikut:",
        "https://rsvp.edwardjessica.com/JESSmarriED-2295A3FMJQWX",
        "",
        "Terima kasih.",
        "Edward & Jessica",
      ].join("\n"),
    );
    expect(
      buildAdminWhatsAppMessage({
        invitation: hadi,
        content,
        messageType: "rsvp_confirmation",
        baseUrl: "https://rsvp.edwardjessica.com",
      }),
    ).toContain("https://rsvp.edwardjessica.com/JESSmarriED-2295A3FMJQWX");
  });
});

let ipCounter = 0;
function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/rsvp/personal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.7.0.${(ipCounter += 1)}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

function answer(overrides: Record<string, unknown> = {}) {
  return {
    code: "JESSMARRIED-2295A3FMJQWX",
    attending: true,
    guestCount: 2,
    guestNames: ["Bp. Hadi", "Istri"],
    dietary: "",
    email: "",
    website: "",
    language: "id",
    ...overrides,
  };
}

function stubResend() {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("POST /api/rsvp/personal (PL-3)", () => {
  it("a Yes saves the party as named, dinner only, with the dietary note; no email without an address", async () => {
    const fetchMock = stubResend();
    const response = await post(
      answer({ guestNames: ["Bp. Hadi Tan", "Ibu Wati"], dietary: "1 vegetarian" }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; invite: PersonalInvite; late: boolean; emailStatus: string };
    expect(json).toMatchObject({ ok: true, late: false, emailStatus: "skipped" });
    expect(json.invite).toEqual({
      code: "JESSMARRIED-2295A3FMJQWX",
      displayName: "Bp. Hadi & Istri",
      guestNames: ["Bp. Hadi Tan", "Ibu Wati"],
      maxGuests: 2,
      status: "attending",
      dietary: "1 vegetarian",
    });
    const saved = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!;
    expect(saved.rsvp).toMatchObject({
      status: "attending",
      eventAttendance: { dinner: true },
      message: "Dietary: 1 vegetarian",
      updatedBy: "guest",
    });
    expect(saved.guests.map((guest) => [guest.name, guest.mealPreference])).toEqual([
      ["Bp. Hadi Tan", "unset"],
      ["Ibu Wati", "unset"],
    ]);
    expect(saved.rsvpDeadline).toBe(NO_RSVP_DEADLINE);
    expect(fetchMock).not.toHaveBeenCalled();
    // No deadline: never marked late in admin.
    expect((await getAdminSnapshot()).lateResponses[saved.id]).toBeUndefined();
  });

  it("a change keeps the first answer's time, drops a guest when fewer come, and a No keeps the party", async () => {
    const first = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!.rsvp.submittedAt;
    expect(first).toBeTruthy();
    await post(answer({ guestCount: 1, guestNames: ["Bp. Hadi Tan"] }));
    let saved = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!;
    expect(saved.guests.map((guest) => guest.name)).toEqual(["Bp. Hadi Tan"]);
    expect(saved.rsvp.message).toBeUndefined();
    expect(saved.rsvp.submittedAt).toBe(first);

    await post(answer({ attending: false, guestNames: [] }));
    saved = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!;
    expect(saved.rsvp).toMatchObject({ status: "declined", eventAttendance: {} });
    expect(saved.guests.map((guest) => guest.name)).toEqual(["Bp. Hadi Tan"]);

    // Back to two: a new second guest is added.
    await post(answer({ guestNames: ["Bp. Hadi", "Istri"] }));
    saved = (await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!;
    expect(saved.guests.map((guest) => guest.name)).toEqual(["Bp. Hadi", "Istri"]);
  });

  it("an email address sends the simple confirmation there and is kept for admin", async () => {
    const fetchMock = stubResend();
    const response = await post(
      answer({ code: "JESSMARRIED-7788BCDEFGHJ", guestNames: ["Pak Joko", "Ibu Dewi"], email: "joko@example.com" }),
    );
    expect(await response.json()).toMatchObject({ ok: true, emailStatus: "sent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as { to: string; html: string };
    expect(sent.to).toBe("joko@example.com");
    expect(sent.html).toContain("Pak Joko");
    expect((await getInvitationByCode("JESSMARRIED-7788BCDEFGHJ"))!.email).toBe("joko@example.com");
  });

  it("refuses missing names and too many people without saving", async () => {
    const before = await getInvitationByCode("JESSMARRIED-5317KPRTVXYZ");
    let response = await post(answer({ code: "JESSMARRIED-5317KPRTVXYZ", guestNames: ["Bp. Slamet", ""] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Please enter guest 2's name.");
    response = await post(
      answer({ code: "JESSMARRIED-6402HJMNQSTW", guestCount: 3, guestNames: ["A", "B", "C"] }),
    );
    expect(response.status).toBe(400);
    expect(await getInvitationByCode("JESSMARRIED-5317KPRTVXYZ")).toEqual(before);
  });

  it("only takes codes owned by an enabled simple link", async () => {
    for (const code of ["EJ26-BRILIAN", "JESSMARRIED-9999ZZZZZZZZ", "JESSMARRIED-SIMPLE", ""]) {
      const response = await post(answer({ code }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("This link can't be used.");
    }
  });

  it("a filled honeypot looks saved but changes nothing", async () => {
    const before = await getInvitationByCode("JESSMARRIED-6402HJMNQSTW");
    const response = await post(
      answer({ code: "JESSMARRIED-6402HJMNQSTW", guestCount: 1, guestNames: ["Bot"], website: "spam" }),
    );
    expect(await response.json()).toMatchObject({ ok: true });
    expect(await getInvitationByCode("JESSMARRIED-6402HJMNQSTW")).toEqual(before);
  });

  it("is closed after the invitation's own deadline (403) and late inside the late window", async () => {
    const office = (await getInvitationByCode("JESSMARRIED-6402HJMNQSTW"))!;
    await upsertInvitationByAdmin({ ...invitationToDraft(office), rsvpDeadline: PAST });
    try {
      let response = await post(answer({ code: "JESSMARRIED-6402HJMNQSTW", guestCount: 1, guestNames: ["Bp. Slamet"] }));
      expect(response.status).toBe(403);

      const draft = await getDraftContent();
      await saveDraftContent({ ...draft, lateRsvp: { enabled: true } });
      await publishDraftContent();
      response = await post(answer({ code: "JESSMARRIED-6402HJMNQSTW", guestCount: 1, guestNames: ["Bp. Slamet"] }));
      expect(await response.json()).toMatchObject({ ok: true, late: true });
    } finally {
      const draft = await getDraftContent();
      await saveDraftContent({ ...draft, lateRsvp: originalDraft.lateRsvp });
      await publishDraftContent();
    }
  });
});

function digestOf(run: () => Promise<unknown>) {
  return run().then(
    () => "",
    (error: { digest?: string }) => String(error?.digest ?? ""),
  );
}

describe("personal link routes (PL-1)", () => {
  it("/JESSmarriED-2295A3FMJQWX opens the simple link's page with the guest's invite, in Indonesian", async () => {
    const page = (await SlugPage({ params: Promise.resolve({ slug: "JESSmarriED-2295A3FMJQWX" }) })) as {
      props: { inviteType: PublicInviteType; personal: PersonalInvite; initialLanguage: string };
    };
    expect(page.props.inviteType.code).toBe("JESSMARRIED-SIMPLE");
    expect(page.props.personal).toEqual(
      toPersonalInvite((await getInvitationByCode("JESSMARRIED-2295A3FMJQWX"))!),
    );
    expect(page.props.initialLanguage).toBe("id");
    // The link's own address is unchanged (no personal invite).
    const link = (await SlugPage({ params: Promise.resolve({ slug: "JESSmarriED" }) })) as {
      props: { personal?: PersonalInvite };
    };
    expect(link.props.personal).toBeUndefined();
  });

  it("an unknown code is a 404", async () => {
    expect(
      await digestOf(() => SlugPage({ params: Promise.resolve({ slug: "JESSmarriED-1111AAAAAAAA" }) })),
    ).toMatch(/404|NOT_FOUND/);
  });

  it("/invite/JESSMARRIED-2295A3FMJQWX goes to the personal link instead of the email-code page", async () => {
    expect(
      await digestOf(() => InviteCodePage({ params: Promise.resolve({ code: "jessmarried-2295a3fmjqwx" }) })),
    ).toContain("/JESSmarriED-2295A3FMJQWX");
  });
});
