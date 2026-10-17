import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import {
  createSelfRegisteredInvitation,
  deleteInvitationByAdmin,
  getAdminSnapshot,
  getDraftContent,
  getPublishedContent,
  publishDraftContent,
  saveDraftContent,
  upsertInvitationByAdmin,
} from "@/lib/data-store";
import { invitationToDraft } from "@/lib/admin-drafts";
import {
  buildAdminWhatsAppMessage,
  deriveLateResponses,
  getDefaultPublicInviteType,
  getEffectiveRsvpDeadline,
  getRsvpDaysLeft,
  getRsvpWindow,
  isNoRsvpDeadline,
  NO_RSVP_DEADLINE,
  normalizeDeadlineIso,
  toGuestContent,
  toGuestInvitation,
} from "@/lib/rsvp";
import { sampleInvitations } from "@/lib/seed";
import type { InvitationGroup, WeddingContent } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// ND-1: "No deadline" for a public link or a single invitation.
const PAST_MAIN = "2026-10-12T16:59:59.000Z"; // main deadline, already passed
const AFTER_WEDDING = new Date("2027-01-15T00:00:00.000Z");
const FAR_FUTURE = new Date("2100-01-01T00:00:00.000Z");

const stubRouter = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
} as unknown as AppRouterInstance;

function withRouter(element: ReactElement) {
  return (
    <AppRouterContext.Provider value={stubRouter}>{element}</AppRouterContext.Provider>
  );
}

function rsvpSection(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  return html.slice(html.indexOf('id="rsvp"'));
}

describe("no-deadline helpers (ND-1)", () => {
  it("recognises the no-deadline value and nothing else", () => {
    expect(isNoRsvpDeadline(NO_RSVP_DEADLINE)).toBe(true);
    expect(isNoRsvpDeadline("9999-12-31T23:59:59+00:00")).toBe(true);
    expect(isNoRsvpDeadline(PAST_MAIN)).toBe(false);
    expect(isNoRsvpDeadline("2026-11-03T16:59:59.000Z")).toBe(false);
    expect(isNoRsvpDeadline(undefined)).toBe(false);
    expect(isNoRsvpDeadline("")).toBe(false);
    expect(isNoRsvpDeadline("garbage")).toBe(false);
    // Stored and read back (e.g. from Postgres) it stays the same value.
    expect(normalizeDeadlineIso("9999-12-31T23:59:59+00:00")).toBe(NO_RSVP_DEADLINE);
  });

  it("stays open long after the main deadline and the wedding, with no countdown", () => {
    const content = { ...weddingContent, rsvpDeadline: PAST_MAIN };
    const link = { rsvpDeadline: NO_RSVP_DEADLINE };
    const effective = getEffectiveRsvpDeadline(content, { inviteType: link });
    expect(effective).toBe(NO_RSVP_DEADLINE);
    for (const now of [AFTER_WEDDING, FAR_FUTURE]) {
      expect(getRsvpWindow(effective, { lateRsvp: { enabled: false } }, now)).toBe("open");
      expect(getRsvpDaysLeft(effective, now)).toBeNull();
    }
  });

  it("the admin WhatsApp confirmation promises no date", () => {
    const invitation: InvitationGroup = {
      ...sampleInvitations.find((item) => item.code === "EJ26-BRILIAN")!,
      rsvpDeadline: NO_RSVP_DEADLINE,
    };
    const message = buildAdminWhatsAppMessage({
      invitation,
      content: { ...weddingContent, rsvpDeadline: PAST_MAIN },
      messageType: "rsvp_confirmation",
      baseUrl: "https://example.test",
      now: AFTER_WEDDING,
    });
    expect(message).toContain("You can update your RSVP any time from your invitation link.");
    expect(message).not.toContain("9999");
  });

  it("never marks a no-deadline answer as late", () => {
    const invitation: InvitationGroup = {
      ...sampleInvitations.find((item) => item.code === "EJ26-BRILIAN")!,
      rsvpDeadline: NO_RSVP_DEADLINE,
      rsvp: {
        ...sampleInvitations.find((item) => item.code === "EJ26-BRILIAN")!.rsvp,
        submittedAt: "2026-12-01T00:00:00.000Z",
      },
    };
    expect(
      deriveLateResponses(
        [invitation],
        { rsvpDeadline: PAST_MAIN },
        new Map([[invitation.id, "2026-12-05T00:00:00.000Z"]]),
      ),
    ).toEqual({});
  });
});

describe("guest pages with no deadline (ND-1)", () => {
  const content = { ...weddingContent, rsvpDeadline: PAST_MAIN };

  it("public link: open card without an 'RSVP by' date or countdown", () => {
    const generic = { ...getDefaultPublicInviteType(content), rsvpDeadline: NO_RSVP_DEADLINE };
    const html = rsvpSection(
      withRouter(
        <SelfRegisterInvitePage
          content={toGuestContent(content, getEffectiveRsvpDeadline(content, { inviteType: generic }))}
          inviteType={generic}
        />,
      ),
    );
    expect(html).toContain("Ready to confirm?");
    expect(html).toContain(
      "Please review the wedding details above before confirming your attendance.",
    );
    expect(html).toContain("Confirm Attendance");
    expect(html).not.toContain("RSVP by");
    expect(html).not.toMatch(/days? left/);
    expect(html).not.toContain("9999");
    expect(html).not.toContain("RSVP is now closed");
    expect(html).not.toContain("late RSVP");
  });

  it("personal invite: no date in the meta line, no countdown, and Update RSVP stays", () => {
    const brilian = {
      ...toGuestInvitation(sampleInvitations.find((item) => item.code === "EJ26-BRILIAN")!),
      rsvpDeadline: NO_RSVP_DEADLINE,
    };
    const html = rsvpSection(
      <InvitePage
        content={toGuestContent(content, getEffectiveRsvpDeadline(content, { invitation: brilian }))}
        invitation={brilian}
      />,
    );
    expect(html).toContain("RSVP received");
    expect(html).toContain("Update RSVP");
    expect(html).not.toContain("RSVP by");
    expect(html).not.toMatch(/days? left/);
    expect(html).not.toContain("9999");
    expect(html).not.toContain("RSVP is now closed");
  });

  it("Indonesian: no 'RSVP sebelum' date either", () => {
    const generic = { ...getDefaultPublicInviteType(content), rsvpDeadline: NO_RSVP_DEADLINE };
    const html = rsvpSection(
      withRouter(
        <SelfRegisterInvitePage
          content={toGuestContent(content, NO_RSVP_DEADLINE)}
          inviteType={generic}
          initialLanguage="id"
        />,
      ),
    );
    expect(html).toContain("Siap konfirmasi?");
    expect(html).not.toContain("RSVP sebelum");
    expect(html).not.toMatch(/hari lagi/);
  });
});

describe("no deadline through the store (ND-1)", () => {
  let originalDraft: WeddingContent;

  beforeAll(async () => {
    originalDraft = await getDraftContent();
  });

  afterAll(async () => {
    await saveDraftContent(originalDraft);
    await publishDraftContent();
  });

  it("a link set to no deadline keeps it through save and publish, and stamps it on registrants", async () => {
    const draft = await getDraftContent();
    await saveDraftContent({
      ...draft,
      rsvpDeadline: PAST_MAIN,
      publicInviteTypes: draft.publicInviteTypes.map((type) =>
        type.id === "generic" ? { ...type, rsvpDeadline: NO_RSVP_DEADLINE } : type,
      ),
    });
    const published = (await publishDraftContent()) as WeddingContent;
    const generic = (published ?? (await getPublishedContent())).publicInviteTypes.find(
      (type) => type.id === "generic",
    )!;
    expect(generic.rsvpDeadline).toBe(NO_RSVP_DEADLINE);

    const invitation = await createSelfRegisteredInvitation(
      {
        accessCode: "JESSMARRIED",
        email: "no.deadline.registrant@example.com",
        name: "No Deadline Registrant",
        phone: "+628111113",
        guestCount: 1,
        mealPreference: "vegetarian",
        status: "attending",
        eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
      },
      generic,
    );
    try {
      expect(invitation.rsvpDeadline).toBe(NO_RSVP_DEADLINE);
      const snapshot = await getAdminSnapshot();
      expect(snapshot.lateResponses[invitation.id]).toBeUndefined();
    } finally {
      await deleteInvitationByAdmin(invitation.code);
    }
  });

  it("a guest can be given no deadline in admin, and it can be cleared again", async () => {
    const hardwin = sampleInvitations.find((item) => item.code === "EJ26-HARDWIN")!;
    const saved = await upsertInvitationByAdmin({
      ...invitationToDraft(hardwin),
      rsvpDeadline: NO_RSVP_DEADLINE,
    });
    expect(saved.rsvpDeadline).toBe(NO_RSVP_DEADLINE);
    const cleared = await upsertInvitationByAdmin({
      ...invitationToDraft(saved),
      rsvpDeadline: null,
    });
    expect(cleared.rsvpDeadline).toBeUndefined();
  });
});
