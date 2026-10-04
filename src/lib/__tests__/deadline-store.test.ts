import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invitationToDraft, jakartaLocalToIso } from "@/lib/admin-drafts";
import {
  createSelfRegisteredInvitation,
  deleteInvitationByAdmin,
  getDraftContent,
  getInvitationByCode,
  getPublishedContent,
  publishDraftContent,
  saveDraftContent,
  upsertInvitationByAdmin,
} from "@/lib/data-store";
import {
  findPublicInviteTypeByCode,
  getEffectiveRsvpDeadline,
  isRsvpClosed,
} from "@/lib/rsvp";
import type { PublicInviteType, WeddingContent } from "@/lib/types";

// DL-13: per-link / per-invitation deadlines through the preview store (the
// same code paths the Supabase branch mirrors).
const NOV_3 = "2026-11-03T16:59:59.000Z";

const familyAndFriends: PublicInviteType = {
  id: "custom-family-and-friends",
  label: { en: "Family & Friends", id: "Keluarga & Sahabat" },
  code: "FAMILY-AND-FRIENDS",
  flow: "generic",
  maxGuests: 2,
  requireGuestNames: false,
  isEnabled: true,
  rsvpDeadline: "2026-11-03T23:59:59+07:00",
};

describe("per-link deadline in content (DL-3)", () => {
  let originalDraft: WeddingContent;

  beforeAll(async () => {
    originalDraft = await getDraftContent();
  });

  afterAll(async () => {
    await saveDraftContent(originalDraft);
    await publishDraftContent();
  });

  it("normalizer keeps a valid link deadline through save/get/publish and drops invalid ones", async () => {
    const draft = await getDraftContent();
    const saved = await saveDraftContent({
      ...draft,
      publicInviteTypes: [
        ...draft.publicInviteTypes.map((inviteType) =>
          inviteType.id === "family"
            ? { ...inviteType, rsvpDeadline: "not a date" }
            : inviteType.id === "overseas"
              ? { ...inviteType, rsvpDeadline: "" }
              : inviteType,
        ),
        familyAndFriends,
      ],
    });

    const savedLink = saved.publicInviteTypes.find(
      (inviteType) => inviteType.id === familyAndFriends.id,
    );
    expect(savedLink?.rsvpDeadline).toBe(NOV_3);
    expect(
      saved.publicInviteTypes.find((inviteType) => inviteType.id === "family"),
    ).not.toHaveProperty("rsvpDeadline");
    expect(
      saved.publicInviteTypes.find((inviteType) => inviteType.id === "overseas"),
    ).not.toHaveProperty("rsvpDeadline");

    const reloaded = await getDraftContent();
    expect(
      reloaded.publicInviteTypes.find(
        (inviteType) => inviteType.id === familyAndFriends.id,
      )?.rsvpDeadline,
    ).toBe(NOV_3);

    await publishDraftContent();
    const published = await getPublishedContent();
    expect(
      findPublicInviteTypeByCode(published, "family-and-friends")?.rsvpDeadline,
    ).toBe(NOV_3);
  });

  it("default link types carry no deadline by default", async () => {
    const content = await getPublishedContent();
    for (const id of ["generic", "family", "overseas"]) {
      expect(
        content.publicInviteTypes.find((inviteType) => inviteType.id === id),
      ).not.toHaveProperty("rsvpDeadline");
    }
  });
});

describe("per-invitation deadline (DL-5)", () => {
  it("self-registration through a deadline link stamps the link deadline on the invitation", async () => {
    const invitation = await createSelfRegisteredInvitation(
      {
        accessCode: "FAMILY-AND-FRIENDS",
        email: "deadline.link.guest@example.com",
        name: "Deadline Link Guest",
        phone: "+628111111",
        guestCount: 1,
        mealPreference: "vegetarian",
        status: "attending",
        eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
      },
      familyAndFriends,
    );
    expect(invitation.rsvpDeadline).toBe(NOV_3);
    expect((await getInvitationByCode(invitation.code))?.rsvpDeadline).toBe(
      NOV_3,
    );

    // Snapshot: the admin later moves the link deadline to 20 Nov and
    // publishes. The link itself moves; this registrant keeps 3 Nov.
    const NOV_20 = "2026-11-20T16:59:59.000Z";
    const originalDraft = await getDraftContent();
    try {
      await saveDraftContent({
        ...originalDraft,
        publicInviteTypes: [
          ...originalDraft.publicInviteTypes,
          { ...familyAndFriends, rsvpDeadline: NOV_20 },
        ],
      });
      await publishDraftContent();
      const published = await getPublishedContent();
      const link = findPublicInviteTypeByCode(published, "FAMILY-AND-FRIENDS");
      expect(getEffectiveRsvpDeadline(published, { inviteType: link })).toBe(
        NOV_20,
      );

      const stored = await getInvitationByCode(invitation.code);
      expect(stored?.rsvpDeadline).toBe(NOV_3);
      // What /api/rsvp checks for this guest (invitation, then main deadline).
      const guestDeadline = getEffectiveRsvpDeadline(published, {
        invitation: stored,
      });
      expect(guestDeadline).toBe(NOV_3);
      // Even with the link context, the guest's own snapshot wins.
      expect(
        getEffectiveRsvpDeadline(published, {
          invitation: stored,
          inviteType: link,
        }),
      ).toBe(NOV_3);
      const nov10 = new Date("2026-11-10T00:00:00.000Z");
      expect(isRsvpClosed(guestDeadline, nov10)).toBe(true);
      expect(
        isRsvpClosed(
          getEffectiveRsvpDeadline(published, { inviteType: link }),
          nov10,
        ),
      ).toBe(false);
    } finally {
      await saveDraftContent(originalDraft);
      await publishDraftContent();
      await deleteInvitationByAdmin(invitation.code);
    }
  });

  it("self-registration through a link without a deadline stores none", async () => {
    const invitation = await createSelfRegisteredInvitation({
      accessCode: "JESSMARRIED",
      email: "no.deadline.guest@example.com",
      name: "No Deadline Guest",
      phone: "+628111112",
      guestCount: 1,
      mealPreference: "vegetarian",
      status: "declined",
      eventAttendance: {},
    });
    expect(invitation).not.toHaveProperty("rsvpDeadline");
    await deleteInvitationByAdmin(invitation.code);
  });

  it("self-registration never reuses a public link code as the name code", async () => {
    const invitation = await createSelfRegisteredInvitation(
      {
        accessCode: "FAMILY-AND-FRIENDS",
        email: "ej.family.name@example.com",
        name: "Ej Family",
        phone: "+628111113",
        guestCount: 1,
        mealPreference: "vegetarian",
        status: "declined",
        eventAttendance: {},
      },
      familyAndFriends,
      { reservedCodes: ["FAMILY-AND-FRIENDS", "EJ05"] },
    );
    expect(invitation.code).toBe("EJFAMILY2");
    await deleteInvitationByAdmin(invitation.code);
  });

  it("admin upsert sets, keeps (full-row flow change) and clears an override", async () => {
    // The value the dashboard's datetime-local stores for "3 Nov 23:59".
    const uiDeadline = jakartaLocalToIso("2026-11-03T23:59");
    const created = await upsertInvitationByAdmin({
      groupName: "QA Deadline Group",
      greeting: "Dear QA Deadline Group",
      side: "joint",
      flow: "generic",
      eligibleEvents: ["dinner"],
      guests: [{ name: "QA Deadline Guest", mealPreference: "unset" }],
      rsvpDeadline: uiDeadline,
    });
    expect(created.rsvpDeadline).toBe(NOV_3);

    // Inline flow dropdown (updateFlow): the dashboard's own
    // invitationToDraft + new flow. The draft carries the override (the
    // editor shows it and full-row saves send it back).
    expect(invitationToDraft(created).rsvpDeadline).toBe(NOV_3);
    const flowChanged = await upsertInvitationByAdmin({
      ...invitationToDraft(created),
      flow: "family",
    });
    expect(flowChanged.flow).toBe("family");
    expect(flowChanged.rsvpDeadline).toBe(NOV_3);
    expect((await getInvitationByCode(created.code))?.rsvpDeadline).toBe(
      NOV_3,
    );

    // A payload without the key (older dashboard tab, partial client) keeps
    // the stored override.
    const { rsvpDeadline: _omitted, ...draftWithoutKey } =
      invitationToDraft(flowChanged);
    const kept = await upsertInvitationByAdmin(draftWithoutKey);
    expect(kept.rsvpDeadline).toBe(NOV_3);
    expect((await getInvitationByCode(created.code))?.rsvpDeadline).toBe(
      NOV_3,
    );

    // Clearing is explicit: null (the dashboard's Clear button) or "".
    for (const cleared of [null, ""]) {
      await upsertInvitationByAdmin({
        ...invitationToDraft(flowChanged),
        rsvpDeadline: uiDeadline,
      });
      const result = await upsertInvitationByAdmin({
        ...invitationToDraft(flowChanged),
        rsvpDeadline: cleared,
      });
      expect(result.rsvpDeadline).toBeUndefined();
      expect(
        (await getInvitationByCode(created.code))?.rsvpDeadline,
      ).toBeUndefined();
    }

    await expect(
      upsertInvitationByAdmin({
        ...invitationToDraft(flowChanged),
        rsvpDeadline: "next tuesday-ish",
      }),
    ).rejects.toThrow("RSVP deadline override is not a valid date.");

    await deleteInvitationByAdmin(created.code);
  });

  it("admin edits of seed invitations without an override leave none behind", async () => {
    const hardwin = await getInvitationByCode("EJ26-HARDWIN");
    expect(hardwin).not.toBeNull();
    expect(hardwin?.rsvpDeadline).toBeUndefined();
    const saved = await upsertInvitationByAdmin(invitationToDraft(hardwin!));
    expect(saved.rsvpDeadline).toBeUndefined();
  });
});
