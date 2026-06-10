import { describe, expect, it } from "vitest";
import {
  calculateStats,
  createSelfRegisteredInvitation,
  deleteInvitationByAdmin,
  getInvitationByCode,
  getInvitationByVerifiedEmail,
  submitRsvp,
  submitTravelPlan,
  updateRsvpByAdmin,
  upsertInvitationByAdmin,
} from "@/lib/data-store";
import { sampleInvitations } from "@/lib/seed";

describe("dashboard stats", () => {
  it("calculates RSVP overview metrics", () => {
    const stats = calculateStats(sampleInvitations);
    expect(stats.totalInvitedPeople).toBe(5);
    expect(stats.totalInvitations).toBe(3);
    expect(stats.attendingInvitations).toBe(1);
    expect(stats.declinedInvitations).toBe(1);
    expect(stats.pendingInvitations).toBe(1);
    expect(stats.rsvpCompletionRate).toBe(67);
    expect(stats.vegetarianMeals).toBe(1);
  });

  it("creates a self-registered invitation and lets admin override status", async () => {
    const invitation = await createSelfRegisteredInvitation({
      accessCode: "JESSMARRIED",
      email: "preview.guest@example.com",
      name: "Preview Guest",
      phone: "+628111111",
      guestCount: 2,
      guestNames: ["Preview Guest", "Preview Plus One"],
      mealPreference: "vegetarian",
      status: "attending",
      eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
      message: "See you there",
    });

    expect(invitation.source).toBe("generic");
    expect(invitation.eligibleEvents).toEqual([
      "holy_matrimony",
      "tea_lunch",
      "dinner",
    ]);
    expect(invitation.rsvp.eventAttendance).toEqual({
      holy_matrimony: true,
      tea_lunch: true,
      dinner: true,
    });
    expect(invitation.rsvp.status).toBe("attending");
    expect(invitation.guests).toHaveLength(2);
    const resolved = await getInvitationByVerifiedEmail(
      "PREVIEW.GUEST@example.com",
      "generic",
    );
    expect(resolved?.code).toBe(invitation.code);

    const updated = await updateRsvpByAdmin({
      code: invitation.code,
      status: "declined",
    });
    expect(updated.rsvp.status).toBe("declined");
    expect(updated.rsvp.updatedBy).toBe("admin");
  });

  it("lets admin create, edit, and delete a guest group", async () => {
    const created = await upsertInvitationByAdmin({
      groupName: "QA Manual Group",
      greeting: "Dear QA Manual Group",
      phone: "+628222222",
      email: "qa-manual@example.com",
      side: "joint",
      flow: "generic",
      privateNotes: {
        en: "Manual note",
        id: "Catatan manual",
      },
      eligibleEvents: ["holy_matrimony", "dinner"],
      guests: [
        {
          name: "QA Manual Guest",
          mealPreference: "vegetarian",
        },
      ],
    });

    expect(created.code).toMatch(/^EJ26-/);
    expect(created.guests).toHaveLength(1);
    expect(created.eligibleEvents).toEqual(["holy_matrimony", "dinner"]);

    const updated = await upsertInvitationByAdmin({
      code: created.code,
      groupName: "QA Manual Group Updated",
      greeting: "Dear QA Manual Family",
      phone: "+628333333",
      email: "qa-manual-updated@example.com",
      side: "bride",
      flow: "overseas",
      privateNotes: {
        en: "Updated note",
        id: "",
      },
      eligibleEvents: ["tea_lunch", "dinner"],
      guests: [
        {
          id: created.guests[0].id,
          name: "QA Manual Guest Updated",
          mealPreference: "non_vegetarian",
        },
        {
          name: "QA Manual Second Guest",
          mealPreference: "unset",
        },
      ],
    });

    expect(updated.groupName).toBe("QA Manual Group Updated");
    expect(updated.side).toBe("bride");
    expect(updated.flow).toBe("overseas");
    expect(updated.eligibleEvents).toEqual(["tea_lunch", "dinner"]);
    expect(updated.guests.map((guest) => guest.name)).toEqual([
      "QA Manual Guest Updated",
      "QA Manual Second Guest",
    ]);

    await deleteInvitationByAdmin(created.code);
    expect(await getInvitationByCode(created.code)).toBeNull();
  });

  it("allows private invites to add guests only up to the admin max", async () => {
    const created = await upsertInvitationByAdmin({
      groupName: "QA Plus Guest Group",
      greeting: "Dear QA Plus Guest",
      phone: "+628777777",
      email: "qa-plus@example.com",
      maxGuests: 2,
      side: "joint",
      flow: "generic",
      eligibleEvents: ["dinner"],
      guests: [
        {
          name: "QA Plus Primary",
          mealPreference: "unset",
        },
      ],
    });

    const saved = await submitRsvp({
      code: created.code,
      status: "attending",
      eventAttendance: { dinner: true },
      mealPreferences: {
        [created.guests[0].id]: "non_vegetarian",
      },
      additionalGuests: [
        {
          name: "QA Plus One",
          mealPreference: "vegetarian",
        },
      ],
    });
    expect(saved.guests.map((guest) => guest.name)).toContain("QA Plus One");

    await expect(
      submitRsvp({
        code: created.code,
        status: "attending",
        eventAttendance: { dinner: true },
        mealPreferences: {
          [created.guests[0].id]: "non_vegetarian",
        },
        additionalGuests: [
          {
            name: "QA Extra One",
            mealPreference: "vegetarian",
          },
          {
            name: "QA Extra Two",
            mealPreference: "non_vegetarian",
          },
        ],
      }),
    ).rejects.toThrow("This invitation allows up to 2 guests.");

    await deleteInvitationByAdmin(created.code);
  });

  it("saves overseas travel plans only after RSVP is submitted", async () => {
    const pending = await upsertInvitationByAdmin({
      groupName: "QA Overseas Pending",
      greeting: "Dear QA Overseas Pending",
      phone: "+628444444",
      email: "qa-overseas-pending@example.com",
      side: "joint",
      flow: "overseas",
      eligibleEvents: ["holy_matrimony", "tea_lunch", "dinner"],
      guests: [
        {
          name: "QA Overseas Pending Guest",
          mealPreference: "unset",
        },
      ],
    });

    await expect(
      submitTravelPlan({
        code: pending.code,
        arrivalAt: "2026-12-11T05:00:00.000Z",
        departureAt: "2026-12-13T05:00:00.000Z",
        accommodationOption: "assign_roommates",
      }),
    ).rejects.toThrow("Please submit your RSVP before travel plans.");

    const attending = await createSelfRegisteredInvitation(
      {
        accessCode: "EJOVERSEAS",
        email: "preview.overseas@example.com",
        name: "Preview Overseas Guest",
        phone: "+628555555",
        guestCount: 1,
        guestNames: ["Preview Overseas Guest"],
        mealPreference: "non_vegetarian",
        status: "attending",
        eventAttendance: {
          holy_matrimony: true,
          tea_lunch: true,
          dinner: true,
        },
      },
      {
        id: "overseas",
        label: {
          en: "Overseas Guests",
          id: "Tamu Overseas",
        },
        code: "EJOVERSEAS",
        flow: "overseas",
        maxGuests: 1,
        requireGuestNames: false,
        isEnabled: true,
      },
    );

    const travelPlan = await submitTravelPlan({
      code: attending.code,
      arrivalAt: "2026-12-11T05:00:00.000Z",
      departureAt: "2026-12-13T05:00:00.000Z",
      accommodationOption: "specific_roommates",
      preferredRoommates: "Jessica and Edward friends",
    });

    expect(travelPlan.invitationGroupId).toBe(attending.id);
    expect(travelPlan.accommodationOption).toBe("specific_roommates");
    expect(travelPlan.preferredRoommates).toBe("Jessica and Edward friends");

    await deleteInvitationByAdmin(pending.code);
    await deleteInvitationByAdmin(attending.code);
  });

  it("lets family guests submit travel dates without roommate preference", async () => {
    const attending = await createSelfRegisteredInvitation(
      {
        accessCode: "EJFAMILY",
        email: "preview.family@example.com",
        name: "Preview Family Guest",
        phone: "+628666666",
        guestCount: 2,
        guestNames: ["Preview Family Guest", "Preview Family Parent"],
        mealPreference: "non_vegetarian",
        status: "attending",
        eventAttendance: {
          holy_matrimony: true,
          tea_lunch: true,
          dinner: true,
        },
      },
      {
        id: "family",
        label: {
          en: "Family",
          id: "Keluarga",
        },
        code: "EJFAMILY",
        flow: "family",
        maxGuests: 6,
        requireGuestNames: true,
        isEnabled: true,
      },
    );

    const travelPlan = await submitTravelPlan({
      code: attending.code,
      arrivalAt: "2026-12-11T05:00:00.000Z",
      departureAt: "2026-12-13T05:00:00.000Z",
      accommodationOption: "specific_roommates",
      preferredRoommates: "Should be ignored for family",
    });

    expect(travelPlan.invitationGroupId).toBe(attending.id);
    expect(travelPlan.accommodationOption).toBe("assign_roommates");
    expect(travelPlan.preferredRoommates).toBeUndefined();

    await deleteInvitationByAdmin(attending.code);
  });
});
