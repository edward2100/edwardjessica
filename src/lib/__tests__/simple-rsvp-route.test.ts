import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LateRsvpSetting, PublicInviteType, WeddingContent } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// SF-7: POST /api/rsvp/simple. No guest-auth cookie is involved; the real
// preview store saves the RSVPs, only the published content (to hold the
// simple link) and Resend's fetch are stubbed. Time-independent: No deadline
// never closes and 2020 is long past.
const mocks = vi.hoisted(() => ({ getPublishedContent: vi.fn() }));
vi.mock("@/lib/data-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-store")>()),
  getPublishedContent: mocks.getPublishedContent,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentAdmin: async () => ({ email: "edward@example.com" }),
}));

import Papa from "papaparse";
import { GET as exportGet } from "@/app/api/admin/export/route";
import { POST } from "@/app/api/rsvp/simple/route";
import {
  deleteInvitationByAdmin,
  getInvitationByCode,
  getInvitationByVerifiedEmail,
  getInvitations,
} from "@/lib/data-store";
import { NO_RSVP_DEADLINE } from "@/lib/rsvp";

const PAST = "2020-01-01T16:59:59.000Z";
const OWNER_WHATSAPP = "https://wa.me/message/COSKSKIJH7AHP1";
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

function content({
  link = SIMPLE,
  lateRsvp = { enabled: false },
}: { link?: PublicInviteType; lateRsvp?: LateRsvpSetting } = {}): WeddingContent {
  return {
    ...weddingContent,
    rsvpContact: { whatsappUrl: OWNER_WHATSAPP },
    lateRsvp,
    publicInviteTypes: [...weddingContent.publicInviteTypes, link],
  };
}

let ipCounter = 0;
function post(body: unknown, ip = `10.1.0.${(ipCounter += 1)}`) {
  return POST(
    new Request("http://localhost/api/rsvp/simple", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

function rsvp(overrides: Record<string, unknown> = {}) {
  return {
    accessCode: "JESSMARRIED-SIMPLE",
    name: "Ana Tan",
    phone: "+62 8123123123",
    email: `ana.${(ipCounter += 1)}@example.com`,
    attending: true,
    guestCount: 2,
    dietary: "Vegetarian",
    website: "",
    language: "en",
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
const created: string[] = [];

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  mocks.getPublishedContent.mockResolvedValue(content());
});

afterEach(async () => {
  for (const code of created.splice(0)) await deleteInvitationByAdmin(code);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sentEmail(call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  expect(url).toBe("https://api.resend.com/emails");
  return JSON.parse(String(init.body)) as { to: string; subject: string; html: string };
}

async function savedFor(email: string) {
  const invitation = await getInvitationByVerifiedEmail(email);
  if (invitation) created.push(invitation.code);
  return invitation;
}

describe("POST /api/rsvp/simple (SF-4)", () => {
  it("refuses every link that isn't set to the simple form, without saving or sending", async () => {
    const before = (await getInvitations()).length;
    const offLink = { ...SIMPLE, isEnabled: false };
    for (const accessCode of ["JESSMARRIED", "jessmarried", "EJFAMILY", "EJOVERSEAS", "NOPE", "", undefined]) {
      const response = await post(rsvp({ accessCode }));
      expect(response.status, String(accessCode)).toBe(400);
      expect(await response.json()).toEqual({ error: "This link can't be used." });
    }
    mocks.getPublishedContent.mockResolvedValue(content({ link: offLink }));
    expect((await post(rsvp())).status).toBe(400);
    expect((await getInvitations()).length).toBe(before);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a closed simple link answers 403 and saves nothing", async () => {
    mocks.getPublishedContent.mockResolvedValue(
      content({ link: { ...SIMPLE, rsvpDeadline: PAST } }),
    );
    const body = rsvp();
    const response = await post(body);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "RSVP editing is closed." });
    expect(await savedFor(body.email)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a dinner-only invitation with unset meals, the dietary note and the link deadline; no code in the reply", async () => {
    const body = rsvp({ name: "  Ana Maria Tan ", email: "Simple.Route@Example.com " });
    const response = await post(body);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      ok: true,
      existing: false,
      firstName: "Ana",
      status: "attending",
      guestCount: 2,
      emailStatus: "sent",
      late: false,
    });

    const invitation = await savedFor("simple.route@example.com");
    expect(invitation).toMatchObject({
      groupName: "Ana Maria Tan",
      email: "Simple.Route@Example.com",
      phone: "+62 8123123123",
      source: "generic",
      flow: "generic",
      maxGuests: 2,
      eligibleEvents: ["dinner"],
      rsvpDeadline: NO_RSVP_DEADLINE,
      rsvp: {
        status: "attending",
        eventAttendance: { dinner: true },
        message: "Dietary: Vegetarian",
        updatedBy: "guest",
      },
    });
    expect(invitation!.privateNotes?.en).toContain("simple form (/JESSmarriED)");
    expect(invitation!.guests.map((guest) => guest.mealPreference)).toEqual(["unset", "unset"]);
    expect(JSON.stringify(json)).not.toContain(invitation!.code);

    // The simple email, in English, to the typed address.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const email = sentEmail();
    expect(email.to).toBe("Simple.Route@Example.com");
    expect(email.subject).toBe("Your RSVP for Edward & Jessica's wedding");
    expect(email.html).toContain("Saturday, 12 December 2026");
    expect(email.html).toContain(weddingContent.venue.mapsUrl);
    expect(email.html).toContain("Dietary requirements:</strong> Vegetarian");
    expect(email.html).not.toMatch(/dinner|calendar|\/invite\/|\d{1,2}:\d{2}/i);
  });

  it("an email that already has an RSVP (any invitation, any case) changes nothing and sends nothing", async () => {
    const hardwinBefore = await getInvitationByCode("EJ26-HARDWIN");
    const before = (await getInvitations()).length;
    for (const email of ["hardwin.family@example.com", "Hardwin.Family@Example.com"]) {
      const response = await post(rsvp({ email, attending: false }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, existing: true });
    }
    expect((await getInvitations()).length).toBe(before);
    expect(await getInvitationByCode("EJ26-HARDWIN")).toEqual(hardwinBefore);

    // A second RSVP with the same email through this form.
    const first = rsvp();
    expect((await post(first)).status).toBe(200);
    const original = await savedFor(first.email);
    fetchMock.mockClear();
    const again = await post({ ...first, email: first.email.toUpperCase(), guestCount: 1, attending: false });
    expect(await again.json()).toEqual({ ok: true, existing: true });
    expect(await getInvitationByVerifiedEmail(first.email)).toEqual(original);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a No: declined, one guest, no events, and the Indonesian email", async () => {
    const body = rsvp({ attending: false, guestCount: 5, dietary: "", language: "id", name: "Budi" });
    const response = await post(body);
    expect(await response.json()).toMatchObject({
      ok: true,
      existing: false,
      firstName: "Budi",
      status: "declined",
      guestCount: 1,
    });
    const invitation = await savedFor(body.email);
    expect(invitation?.rsvp).toMatchObject({ status: "declined", eventAttendance: {} });
    expect(invitation?.rsvp.message).toBeUndefined();
    expect(invitation?.guests).toHaveLength(1);
    const email = sentEmail();
    expect(email.subject).toBe("Kami telah menerima RSVP Anda untuk pernikahan Edward & Jessica");
    expect(email.html).toContain("Sabtu, 12 Desember 2026");
    expect(email.html).toContain("Buka di Google Maps");
  });

  it("the honeypot: the usual success reply, but nothing saved or sent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const before = (await getInvitations()).length;
    const body = rsvp({ website: "http://spam.example" });
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      existing: false,
      firstName: "Ana",
      status: "attending",
      guestCount: 2,
      emailStatus: "skipped",
      late: false,
    });
    expect((await getInvitations()).length).toBe(before);
    expect(await savedFor(body.email)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Honeypot"));
  });

  it("in the late window it is accepted, marked late, and a Yes email adds the late sentence", async () => {
    mocks.getPublishedContent.mockResolvedValue(
      content({ link: { ...SIMPLE, rsvpDeadline: PAST }, lateRsvp: { enabled: true } }),
    );
    const body = rsvp();
    const response = await post(body);
    expect(await response.json()).toMatchObject({ ok: true, late: true });
    const invitation = await savedFor(body.email);
    expect(invitation?.rsvpDeadline).toBe(PAST);
    expect(sentEmail().html).toContain("Since this came after our RSVP date");
  });

  it("refuses details the form would refuse (400), with a message", async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ email: "a@b.com?bcc=x@y.com" }, "Please enter a valid email address."],
      [{ name: "  " }, "Please enter your name."],
      [{ phone: "call me" }, "Please enter your WhatsApp number."],
      [{ attending: undefined }, "Please tell us if you can attend."],
    ];
    for (const [overrides, message] of cases) {
      const response = await post(rsvp(overrides));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(message);
    }
    expect((await post(rsvp({ guestCount: 3 }))).status).toBe(400);
    expect((await post(rsvp({ dietary: "d".repeat(201) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("email problems never fail the RSVP", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      text: async () => "rejected",
    } as unknown as Response);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rejected = rsvp();
    expect(await (await post(rejected)).json()).toMatchObject({ ok: true, emailStatus: "failed" });
    expect(await savedFor(rejected.email)).not.toBeNull();

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const thrown = rsvp();
    expect(await (await post(thrown)).json()).toMatchObject({ ok: true, emailStatus: "failed" });
    expect(await savedFor(thrown.email)).not.toBeNull();

    vi.stubEnv("RESEND_API_KEY", "");
    const unset = rsvp();
    expect(await (await post(unset)).json()).toMatchObject({ ok: true, emailStatus: "skipped" });
    expect(await savedFor(unset.email)).not.toBeNull();
  });

  it("shares the RSVP rate limit: the 11th try from one address in 10 minutes gets 429", async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await post(rsvp({ accessCode: "NOPE" }), "10.9.9.9")).status).toBe(400);
    }
    const limited = await post(rsvp(), "10.9.9.9");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});

describe("CSV export note column (SF-6)", () => {
  it("every guest row carries the group's RSVP note", async () => {
    const body = rsvp({ name: "Csv Note Guest", dietary: "No pork, please" });
    expect((await post(body)).status).toBe(200);
    const invitation = await savedFor(body.email);
    const response = await exportGet(
      new Request("http://localhost/api/admin/export?format=csv"),
    );
    const csv = await response.text();
    const { data, meta } = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });
    expect(meta.fields).toContain("note");
    const rows = data.filter((row) => row.code === invitation!.code);
    expect(rows.map((row) => [row.guestName, row.mealPreference, row.events, row.note])).toEqual([
      ["Csv Note Guest", "unset", "dinner", "Dietary: No pork, please"],
      ["Csv Note Guest Guest 2", "unset", "dinner", "Dietary: No pork, please"],
    ]);
    // Groups without a message export an empty note.
    expect(data.find((row) => row.code === "EJ26-HARDWIN")?.note).toBe("");
  });
});
