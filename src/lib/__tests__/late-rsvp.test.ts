import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { lateCsvValue } from "@/lib/csv";
import {
  createSelfRegisteredInvitation,
  deleteInvitationByAdmin,
  getAdminSnapshot,
  getDraftContent,
  getPublishedContent,
  publishDraftContent,
  saveDraftContent,
  submitRsvp,
  updateRsvpByAdmin,
  upsertInvitationByAdmin,
} from "@/lib/data-store";
import { lateRsvpText } from "@/lib/i18n";
import {
  deriveLateResponses,
  getRsvpWindow,
  isLateRsvpOpen,
  latestGuestChanges,
  normalizeLateRsvp,
  toGuestContent,
} from "@/lib/rsvp";
import { buildRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";
import type { InvitationGroup, Rsvp, WeddingContent } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// LR-5: late RSVPs. Every clock is injected or faked, so these pass the same
// way before and after 3 Nov 2026 and after the wedding.
const GLOBAL = "2026-10-12T16:59:59.000Z"; // 12 Oct 2026 23:59:59 WIB
const NOV_3 = "2026-11-03T16:59:59.000Z"; // 3 Nov 2026 23:59:59 WIB
const NOV_20 = "2026-11-20T16:59:59.000Z";
const LATE_UNTIL_NOV_3 = { lateRsvp: { enabled: true, until: NOV_3 } };

function at(iso: string, offsetMs = 0) {
  return new Date(Date.parse(iso) + offsetMs);
}

describe("late RSVP window (LR-1)", () => {
  it("is open up to the deadline instant, then late (.000Z vs .001Z)", () => {
    expect(getRsvpWindow(GLOBAL, LATE_UNTIL_NOV_3, at(GLOBAL, -1))).toBe("open");
    expect(getRsvpWindow(GLOBAL, LATE_UNTIL_NOV_3, at(GLOBAL))).toBe("open");
    expect(getRsvpWindow(GLOBAL, LATE_UNTIL_NOV_3, at(GLOBAL, 1))).toBe("late");
    expect(
      getRsvpWindow(GLOBAL, LATE_UNTIL_NOV_3, at("2026-10-20T00:00:00.000Z")),
    ).toBe("late");
  });

  it("accepts late RSVPs up to and including `until`, then closes", () => {
    expect(isLateRsvpOpen(LATE_UNTIL_NOV_3, at(NOV_3))).toBe(true);
    expect(isLateRsvpOpen(LATE_UNTIL_NOV_3, at(NOV_3, 1))).toBe(false);
    expect(getRsvpWindow(GLOBAL, LATE_UNTIL_NOV_3, at(NOV_3))).toBe("late");
    expect(getRsvpWindow(GLOBAL, LATE_UNTIL_NOV_3, at(NOV_3, 1))).toBe("closed");
    // The same instant written with the Jakarta offset.
    const jakarta = { lateRsvp: { enabled: true, until: "2026-11-03T23:59:59+07:00" } };
    expect(getRsvpWindow(GLOBAL, jakarta, at(NOV_3))).toBe("late");
    expect(getRsvpWindow(GLOBAL, jakarta, at(NOV_3, 1))).toBe("closed");
  });

  it("has no end date without `until`, and is closed when disabled or missing", () => {
    const noEnd = { lateRsvp: { enabled: true } };
    expect(isLateRsvpOpen(noEnd, at("2099-01-01T00:00:00.000Z"))).toBe(true);
    expect(getRsvpWindow(GLOBAL, noEnd, at("2027-06-01T00:00:00.000Z"))).toBe("late");

    const disabled = { lateRsvp: { enabled: false, until: NOV_3 } };
    expect(isLateRsvpOpen(disabled, at(GLOBAL, 1))).toBe(false);
    expect(getRsvpWindow(GLOBAL, disabled, at(GLOBAL))).toBe("open");
    expect(getRsvpWindow(GLOBAL, disabled, at(GLOBAL, 1))).toBe("closed");
    expect(getRsvpWindow(GLOBAL, {}, at(GLOBAL, 1))).toBe("closed");
  });

  it("treats an invalid `until` as no end date, like the normalizer", () => {
    const invalid = { lateRsvp: { enabled: true, until: "next tuesday-ish" } };
    expect(isLateRsvpOpen(invalid, at("2099-01-01T00:00:00.000Z"))).toBe(true);
    expect(normalizeLateRsvp(invalid.lateRsvp)).toEqual({ enabled: true });
    expect(normalizeLateRsvp({ enabled: true, until: "   " })).toEqual({
      enabled: true,
    });
  });

  it("only a strict `true` enables late RSVPs", () => {
    for (const enabled of ["true", 1, "yes", null, undefined, {}]) {
      expect(normalizeLateRsvp({ enabled, until: NOV_3 }), String(enabled)).toEqual({
        enabled: false,
        until: NOV_3,
      });
      expect(
        isLateRsvpOpen(
          { lateRsvp: { enabled, until: NOV_3 } as unknown as { enabled: boolean } },
          at(GLOBAL, 1),
        ),
      ).toBe(false);
    }
    expect(normalizeLateRsvp(null)).toEqual({ enabled: false });
    expect(normalizeLateRsvp("on")).toEqual({ enabled: false });
    expect(
      normalizeLateRsvp({ enabled: true, until: "2026-11-03T23:59:59+07:00" }),
    ).toEqual({ enabled: true, until: NOV_3 });
  });

  it("a per-invitation extension past `until` stays open, then closes (late already over)", () => {
    expect(getRsvpWindow(NOV_20, LATE_UNTIL_NOV_3, at("2026-11-10T00:00:00.000Z"))).toBe(
      "open",
    );
    expect(getRsvpWindow(NOV_20, LATE_UNTIL_NOV_3, at(NOV_20, 1))).toBe("closed");
  });

  it("code default: late RSVPs on until 3 Nov 23:59:59 WIB, kept for guests", () => {
    expect(weddingContent.lateRsvp).toEqual({ enabled: true, until: NOV_3 });
    const guest = toGuestContent(weddingContent, GLOBAL);
    expect(guest.lateRsvp).toEqual({ enabled: true, until: NOV_3 });
    expect(guest.rsvpDeadline).toBe(GLOBAL);
  });
});

describe("late RSVP setting in stored content (LR-1)", () => {
  let originalDraft: WeddingContent;

  beforeAll(async () => {
    originalDraft = await getDraftContent();
  });

  afterAll(async () => {
    await saveDraftContent(originalDraft);
    await publishDraftContent();
  });

  it("stored content without a lateRsvp key inherits the code default", async () => {
    const store = (
      globalThis as typeof globalThis & {
        __ejPreviewStore?: { content: Partial<WeddingContent> };
      }
    ).__ejPreviewStore;
    expect(store).toBeDefined();
    const published = store!.content;
    const saved = published.lateRsvp;
    delete published.lateRsvp;
    try {
      expect("lateRsvp" in published).toBe(false);
      expect((await getPublishedContent()).lateRsvp).toEqual({
        enabled: true,
        until: NOV_3,
      });
    } finally {
      published.lateRsvp = saved;
    }

    // A draft saved without the key (an older dashboard tab) gets it too.
    const withoutKey: Partial<WeddingContent> = { ...originalDraft };
    delete withoutKey.lateRsvp;
    const savedDraft = await saveDraftContent(withoutKey as WeddingContent);
    expect(savedDraft.lateRsvp).toEqual({ enabled: true, until: NOV_3 });
  });

  it("an explicit { enabled: false } survives save + publish (no default fallback)", async () => {
    const off = await saveDraftContent({
      ...originalDraft,
      lateRsvp: { enabled: false },
    });
    expect(off.lateRsvp).toEqual({ enabled: false });
    await publishDraftContent();
    // Round-trip through JSON, as the admin dashboard sends it.
    const roundTrip = JSON.parse(
      JSON.stringify(await getDraftContent()),
    ) as WeddingContent;
    await saveDraftContent(roundTrip);
    await publishDraftContent();
    expect((await getPublishedContent()).lateRsvp).toEqual({ enabled: false });
    expect((await getDraftContent()).lateRsvp).toEqual({ enabled: false });
  });

  it("an invalid or blank end date is saved as no end date; a Jakarta time is canonical", async () => {
    for (const until of ["not a date", ""]) {
      const saved = await saveDraftContent({
        ...originalDraft,
        lateRsvp: { enabled: true, until },
      });
      expect(saved.lateRsvp).toEqual({ enabled: true });
    }
    const jakarta = await saveDraftContent({
      ...originalDraft,
      lateRsvp: { enabled: true, until: "2026-11-03T23:59:59+07:00" },
    });
    expect(jakarta.lateRsvp).toEqual({ enabled: true, until: NOV_3 });
    const garbage = await saveDraftContent({
      ...originalDraft,
      lateRsvp: { enabled: "yes", until: NOV_3 } as unknown as WeddingContent["lateRsvp"],
    });
    expect(garbage.lateRsvp).toEqual({ enabled: false, until: NOV_3 });
  });
});

function invitationWith(
  id: string,
  rsvp: Partial<Rsvp>,
  rsvpDeadline?: string,
): InvitationGroup {
  return {
    id,
    code: id.toUpperCase(),
    greeting: `Dear ${id}`,
    groupName: id,
    maxGuests: 1,
    side: "joint",
    flow: "generic",
    eligibleEvents: ["dinner"],
    rsvp: {
      id: `rsvp-${id}`,
      invitationGroupId: id,
      status: "attending",
      eventAttendance: { dinner: true },
      ...rsvp,
    },
    guests: [],
    ...(rsvpDeadline ? { rsvpDeadline } : {}),
  };
}

describe("late marker derivation (LR-3)", () => {
  const content = { rsvpDeadline: GLOBAL };
  const ON_TIME = "2026-10-05T03:00:00.000Z";
  const AFTER = "2026-10-20T03:00:00.000Z";

  it("marks only answers that reached the couple after the guest's deadline", () => {
    const invitations = [
      // On time, then the admin edited it after the deadline.
      invitationWith("on-time-admin-edit", { submittedAt: ON_TIME, updatedAt: AFTER }),
      // First answer after the deadline.
      invitationWith("first-late", { submittedAt: AFTER, updatedAt: AFTER }),
      // On time, then the guest changed it after the deadline.
      invitationWith("changed-late", { submittedAt: ON_TIME, updatedAt: AFTER }),
      // Admin-only history after the deadline (admin recorded it in time).
      invitationWith("admin-only", { submittedAt: ON_TIME, updatedBy: "admin" }),
      // Own extension to 20 Nov: neither the change nor the answer is late.
      invitationWith("extended-change", { submittedAt: ON_TIME }, NOV_20),
      invitationWith("extended-first", { submittedAt: AFTER }, NOV_20),
      // Never answered.
      invitationWith("pending", { status: "pending", eventAttendance: {} }),
    ];
    const guestChanges = latestGuestChanges([
      { invitationGroupId: "on-time-admin-edit", changedBy: "guest", changedAt: ON_TIME },
      { invitationGroupId: "on-time-admin-edit", changedBy: "admin", changedAt: AFTER },
      { invitationGroupId: "first-late", changedBy: "guest", changedAt: AFTER },
      { invitationGroupId: "changed-late", changedBy: "guest", changedAt: ON_TIME },
      { invitationGroupId: "changed-late", changedBy: "guest", changedAt: AFTER },
      { invitationGroupId: "admin-only", changedBy: "admin", changedAt: ON_TIME },
      { invitationGroupId: "admin-only", changedBy: "admin", changedAt: AFTER },
      { invitationGroupId: "extended-change", changedBy: "guest", changedAt: AFTER },
      { invitationGroupId: "extended-first", changedBy: "guest", changedAt: AFTER },
    ]);
    expect(deriveLateResponses(invitations, content, guestChanges)).toEqual({
      "first-late": { kind: "late", at: AFTER },
      "changed-late": { kind: "changed_late", at: AFTER },
    });
  });

  it("is strict at the deadline instant and ignores a pending status", () => {
    const changes = new Map<string, string>();
    expect(
      deriveLateResponses(
        [
          invitationWith("at-deadline", { submittedAt: GLOBAL }),
          invitationWith("just-after", { submittedAt: at(GLOBAL, 1).toISOString() }),
          // Reset to pending by the admin: not an answer any more.
          invitationWith("reset", { status: "pending", submittedAt: AFTER }),
        ],
        content,
        changes,
      ),
    ).toEqual({
      "just-after": { kind: "late", at: "2026-10-12T16:59:59.001Z" },
    });
  });

  it("latestGuestChanges keeps the newest guest row per invitation", () => {
    const latest = latestGuestChanges([
      { invitationGroupId: "a", changedBy: "guest", changedAt: AFTER },
      { invitationGroupId: "a", changedBy: "guest", changedAt: ON_TIME },
      { invitationGroupId: "a", changedBy: "admin", changedAt: "2026-12-01T00:00:00.000Z" },
      { invitationGroupId: "b", changedBy: "admin", changedAt: AFTER },
    ]);
    expect([...latest.entries()]).toEqual([["a", AFTER]]);
  });
});

describe("late markers in the admin snapshot (LR-3, preview store)", () => {
  let originalDraft: WeddingContent;
  const created: string[] = [];

  beforeAll(async () => {
    originalDraft = await getDraftContent();
    // Guests were held to the published 12 Oct deadline.
    await saveDraftContent({
      ...originalDraft,
      rsvpDeadline: GLOBAL,
      lateRsvp: { enabled: true, until: NOV_3 },
    });
    await publishDraftContent();
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const code of created) await deleteInvitationByAdmin(code);
    await saveDraftContent(originalDraft);
    await publishDraftContent();
  });

  async function newGuestGroup(name: string, rsvpDeadline?: string) {
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    const invitation = await upsertInvitationByAdmin({
      groupName: name,
      greeting: `Dear ${name}`,
      side: "joint",
      flow: "generic",
      eligibleEvents: ["dinner"],
      guests: [{ name, mealPreference: "vegetarian" }],
      ...(rsvpDeadline ? { rsvpDeadline } : {}),
    });
    created.push(invitation.code);
    return invitation;
  }

  async function guestAnswers(code: string, isoTime: string) {
    vi.setSystemTime(new Date(isoTime));
    return submitRsvp(
      { code, status: "attending", eventAttendance: { dinner: true }, mealPreferences: {} },
      "guest",
    );
  }

  async function adminSets(code: string, isoTime: string, status: Rsvp["status"]) {
    vi.setSystemTime(new Date(isoTime));
    return updateRsvpByAdmin({ code, status });
  }

  async function lateMarker(id: string) {
    vi.setSystemTime(new Date("2026-11-30T00:00:00.000Z"));
    return (await getAdminSnapshot()).lateResponses[id];
  }

  it("on-time answer, then an admin edit after the deadline -> none", async () => {
    const group = await newGuestGroup("LR On Time Admin Edit");
    await guestAnswers(group.code, "2026-10-05T03:00:00.000Z");
    await adminSets(group.code, "2026-10-20T03:00:00.000Z", "declined");
    expect(await lateMarker(group.id)).toBeUndefined();
  });

  it("first answer after the deadline -> late", async () => {
    const group = await newGuestGroup("LR First Answer Late");
    await guestAnswers(group.code, "2026-10-20T03:00:00.000Z");
    expect(await lateMarker(group.id)).toEqual({
      kind: "late",
      at: "2026-10-20T03:00:00.000Z",
    });
  });

  it("on-time answer + a guest change after the deadline -> changed late", async () => {
    const group = await newGuestGroup("LR Changed Late");
    await guestAnswers(group.code, "2026-10-05T03:00:00.000Z");
    await guestAnswers(group.code, "2026-10-21T03:00:00.000Z");
    expect(await lateMarker(group.id)).toEqual({
      kind: "changed_late",
      at: "2026-10-21T03:00:00.000Z",
    });
  });

  it("admin-only changes after the deadline -> none", async () => {
    const group = await newGuestGroup("LR Admin Only");
    await adminSets(group.code, "2026-10-06T03:00:00.000Z", "attending");
    await adminSets(group.code, "2026-10-22T03:00:00.000Z", "declined");
    expect(await lateMarker(group.id)).toBeUndefined();
  });

  it("an admin recording a guest who never answered, after the deadline -> late", async () => {
    const group = await newGuestGroup("LR Admin Records Late");
    await adminSets(group.code, "2026-10-23T03:00:00.000Z", "attending");
    expect(await lateMarker(group.id)).toEqual({
      kind: "late",
      at: "2026-10-23T03:00:00.000Z",
    });
  });

  it("a per-invitation extension later than the answer or change -> none", async () => {
    const firstAnswer = await newGuestGroup("LR Extended First", NOV_20);
    await guestAnswers(firstAnswer.code, "2026-10-24T03:00:00.000Z");
    const change = await newGuestGroup("LR Extended Change", NOV_20);
    await guestAnswers(change.code, "2026-10-05T03:00:00.000Z");
    await guestAnswers(change.code, "2026-10-24T03:00:00.000Z");
    expect(await lateMarker(firstAnswer.id)).toBeUndefined();
    expect(await lateMarker(change.id)).toBeUndefined();
  });

  it("a late self-registration is marked late; the published deadline is used, not a draft edit", async () => {
    vi.setSystemTime(new Date("2026-10-25T03:00:00.000Z"));
    const registered = await createSelfRegisteredInvitation({
      accessCode: "JESSMARRIED",
      email: "late.self.register@example.com",
      name: "Late Self Register",
      phone: "+628111999",
      guestCount: 1,
      mealPreference: "vegetarian",
      status: "attending",
      eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
    });
    created.push(registered.code);
    // An unpublished draft moving the deadline to December changes nothing.
    await saveDraftContent({
      ...(await getDraftContent()),
      rsvpDeadline: "2026-12-01T16:59:59.000Z",
    });
    expect(await lateMarker(registered.id)).toEqual({
      kind: "late",
      at: "2026-10-25T03:00:00.000Z",
    });
    expect((await getAdminSnapshot()).content.rsvpDeadline).toBe(
      "2026-12-01T16:59:59.000Z",
    );
  });

  it("seed answers from June are on time", async () => {
    const snapshot = await getAdminSnapshot();
    expect(snapshot.lateResponses["invite-brilian"]).toBeUndefined();
    expect(snapshot.lateResponses["invite-friends"]).toBeUndefined();
    expect(snapshot.lateResponses["invite-hardwin"]).toBeUndefined();
  });
});

describe("late RSVP copy, email and export (LR-2/LR-3/LR-4)", () => {
  it("fills {until} with the end date in the guest's language, or nothing", () => {
    expect(lateRsvpText("Send it{until}.", "en", NOV_3)).toBe(
      "Send it until 3 November 2026.",
    );
    expect(lateRsvpText("Kirim{until}.", "id", NOV_3)).toBe(
      "Kirim hingga 3 November 2026.",
    );
    expect(lateRsvpText("Send it{until}.", "en", undefined)).toBe("Send it.");
    expect(lateRsvpText("Send it{until}.", "en", "garbage")).toBe("Send it.");
  });

  it("the confirmation email adds one sentence for a late RSVP and is otherwise unchanged", () => {
    const invitation = invitationWith("email-late", { submittedAt: "2026-10-20T03:00:00.000Z" });
    const lateLine =
      "<p>Since this came after our RSVP date, we'll confirm your place with you. We'd also appreciate a quick message to Edward or Jessica on Telegram or WhatsApp.</p>";
    const onTime = buildRsvpConfirmationEmail({ content: weddingContent, invitation });
    const notLate = buildRsvpConfirmationEmail({
      content: weddingContent,
      invitation,
      late: false,
    });
    const late = buildRsvpConfirmationEmail({
      content: weddingContent,
      invitation,
      late: true,
    });
    expect(late.html).toContain(lateLine);
    expect(onTime.html).not.toContain("after our RSVP date");
    expect(notLate.html).toBe(onTime.html);
    expect(late.subject).toBe(onTime.subject);
    // Right after the "details we have received" line; nothing else changes.
    expect(late.html).toContain(
      `Here are the details we have received:</p>\n      ${lateLine}\n`,
    );
    expect(late.html.replace(`\n      ${lateLine}`, "")).toBe(onTime.html);
  });

  it("the confirmation email for a late decline adds no follow-up sentence", () => {
    const invitation = invitationWith("email-late-decline", {
      status: "declined",
      eventAttendance: {},
      submittedAt: "2026-10-20T03:00:00.000Z",
    });
    const onTime = buildRsvpConfirmationEmail({ content: weddingContent, invitation });
    const late = buildRsvpConfirmationEmail({
      content: weddingContent,
      invitation,
      late: true,
    });
    expect(late.html).not.toContain("after our RSVP date");
    expect(late.html).toBe(onTime.html);
  });

  it("the CSV `late` column", () => {
    expect(lateCsvValue({ kind: "late", at: "2026-10-20T03:00:00.000Z" })).toBe("late");
    expect(lateCsvValue({ kind: "changed_late", at: "2026-10-20T03:00:00.000Z" })).toBe(
      "changed late",
    );
    expect(lateCsvValue(undefined)).toBe("");
  });
});
