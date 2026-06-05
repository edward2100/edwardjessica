import { describe, expect, it } from "vitest";
import {
  calculateStats,
  createSelfRegisteredInvitation,
  deleteInvitationByAdmin,
  getInvitationByCode,
  updateRsvpByAdmin,
  upsertInvitationByAdmin
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
      name: "Preview Guest",
      phone: "+628111111",
      guestCount: 2,
      mealPreference: "vegetarian",
      status: "attending",
      eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
      message: "See you there"
    });

    expect(invitation.source).toBe("generic");
    expect(invitation.eligibleEvents).toEqual(["holy_matrimony", "tea_lunch", "dinner"]);
    expect(invitation.rsvp.eventAttendance).toEqual({
      holy_matrimony: true,
      tea_lunch: true,
      dinner: true
    });
    expect(invitation.rsvp.status).toBe("attending");
    expect(invitation.guests).toHaveLength(2);

    const updated = await updateRsvpByAdmin({
      code: invitation.code,
      status: "declined"
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
      privateNotes: {
        en: "Manual note",
        id: "Catatan manual"
      },
      eligibleEvents: ["holy_matrimony", "dinner"],
      guests: [
        {
          name: "QA Manual Guest",
          mealPreference: "vegetarian"
        }
      ]
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
      privateNotes: {
        en: "Updated note",
        id: ""
      },
      eligibleEvents: ["tea_lunch", "dinner"],
      guests: [
        {
          id: created.guests[0].id,
          name: "QA Manual Guest Updated",
          mealPreference: "non_vegetarian"
        },
        {
          name: "QA Manual Second Guest",
          mealPreference: "unset"
        }
      ]
    });

    expect(updated.groupName).toBe("QA Manual Group Updated");
    expect(updated.side).toBe("bride");
    expect(updated.eligibleEvents).toEqual(["tea_lunch", "dinner"]);
    expect(updated.guests.map((guest) => guest.name)).toEqual([
      "QA Manual Guest Updated",
      "QA Manual Second Guest"
    ]);

    await deleteInvitationByAdmin(created.code);
    expect(await getInvitationByCode(created.code)).toBeNull();
  });
});
