import { describe, expect, it } from "vitest";
import { isoToJakartaLocal, jakartaLocalToIso } from "@/lib/admin-drafts";
import {
  customPublicLinkCode,
  discoverMedanHref,
  invitationHref,
  publicLinkShortPath,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import {
  buildAdminWhatsAppMessage,
  buildNameInviteCode,
  formatRsvpDeadlineDate,
  getEffectiveRsvpDeadline,
  isRsvpClosed,
  normalizeDeadlineIso,
  toGuestContent,
} from "@/lib/rsvp";
import type { InvitationGroup, PublicInviteType } from "@/lib/types";
import { RSVP_DEADLINE, weddingContent } from "@/lib/wedding-content";

// DL-13: per-link / per-invitation RSVP deadline helpers.
const NOV_3 = "2026-11-03T16:59:59.000Z"; // 3 Nov 2026 23:59:59 WIB
const GLOBAL = "2026-10-12T16:59:59.000Z"; // 12 Oct 2026 23:59:59 WIB

const familyAndFriends: PublicInviteType = {
  id: "custom-family-and-friends",
  label: { en: "Family & Friends", id: "Keluarga & Sahabat" },
  code: "FAMILY-AND-FRIENDS",
  flow: "generic",
  maxGuests: 2,
  requireGuestNames: false,
  isEnabled: true,
  rsvpDeadline: NOV_3,
};

function invitationWith(rsvpDeadline?: string): InvitationGroup {
  return {
    id: "invite-deadline-test",
    code: "DEADLINETEST",
    greeting: "Dear Deadline Test",
    groupName: "Deadline Test",
    maxGuests: 1,
    side: "joint",
    source: "admin",
    flow: "generic",
    eligibleEvents: ["dinner"],
    rsvp: {
      id: "rsvp-deadline-test",
      invitationGroupId: "invite-deadline-test",
      status: "attending",
      eventAttendance: { dinner: true },
    },
    guests: [
      {
        id: "guest-deadline-test",
        invitationGroupId: "invite-deadline-test",
        name: "Deadline Test",
        mealPreference: "vegetarian",
      },
    ],
    ...(rsvpDeadline ? { rsvpDeadline } : {}),
  };
}

describe("RSVP deadline helpers (DL)", () => {
  it("normalizeDeadlineIso returns canonical ISO and drops blank or invalid values", () => {
    expect(normalizeDeadlineIso("2026-11-03T23:59:59+07:00")).toBe(NOV_3);
    expect(normalizeDeadlineIso(NOV_3)).toBe(NOV_3);
    expect(normalizeDeadlineIso("")).toBeUndefined();
    expect(normalizeDeadlineIso("   ")).toBeUndefined();
    expect(normalizeDeadlineIso(null)).toBeUndefined();
    expect(normalizeDeadlineIso(undefined)).toBeUndefined();
    expect(normalizeDeadlineIso("not a date")).toBeUndefined();
    expect(normalizeDeadlineIso(12345)).toBeUndefined();
  });

  it("effective deadline precedence: invitation > link > content > constant", () => {
    const content = { rsvpDeadline: GLOBAL };
    const ownOverride = "2026-12-01T16:59:00.000Z";
    expect(getEffectiveRsvpDeadline(content)).toBe(GLOBAL);
    expect(
      getEffectiveRsvpDeadline(content, { inviteType: familyAndFriends }),
    ).toBe(NOV_3);
    expect(
      getEffectiveRsvpDeadline(content, {
        invitation: invitationWith(ownOverride),
        inviteType: familyAndFriends,
      }),
    ).toBe(ownOverride);
    // An invitation without its own deadline falls through to the link, then global.
    expect(
      getEffectiveRsvpDeadline(content, {
        invitation: invitationWith(),
        inviteType: familyAndFriends,
      }),
    ).toBe(NOV_3);
    expect(
      getEffectiveRsvpDeadline(content, { invitation: invitationWith() }),
    ).toBe(GLOBAL);
    expect(getEffectiveRsvpDeadline(content, { invitation: null })).toBe(GLOBAL);
  });

  it("invalid or blank deadlines fall back instead of failing open", () => {
    expect(
      getEffectiveRsvpDeadline(
        { rsvpDeadline: GLOBAL },
        {
          invitation: { rsvpDeadline: "garbage" },
          inviteType: { rsvpDeadline: "" },
        },
      ),
    ).toBe(GLOBAL);
    // Empty / invalid main deadline -> code constant, never NaN.
    expect(getEffectiveRsvpDeadline({ rsvpDeadline: "" })).toBe(RSVP_DEADLINE);
    expect(getEffectiveRsvpDeadline({ rsvpDeadline: "nope" })).toBe(
      RSVP_DEADLINE,
    );
    const afterConstant = new Date(
      new Date(RSVP_DEADLINE).getTime() + 1,
    );
    expect(
      isRsvpClosed(getEffectiveRsvpDeadline({ rsvpDeadline: "" }), afterConstant),
    ).toBe(true);
  });

  it("closes strictly after the 3 Nov deadline (.000Z open, .001Z closed)", () => {
    const deadline = getEffectiveRsvpDeadline(
      { rsvpDeadline: GLOBAL },
      { inviteType: familyAndFriends },
    );
    expect(isRsvpClosed(deadline, new Date("2026-11-03T16:59:59.000Z"))).toBe(
      false,
    );
    expect(isRsvpClosed(deadline, new Date("2026-11-03T16:59:59.001Z"))).toBe(
      true,
    );
    // The main deadline has passed by then, but the link stays open.
    expect(isRsvpClosed(GLOBAL, new Date("2026-10-20T00:00:00.000Z"))).toBe(true);
    expect(isRsvpClosed(deadline, new Date("2026-10-20T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("admin deadline inputs store the end of the chosen minute (UI value boundary)", () => {
    // What the dashboard saves for a datetime-local of "3 Nov 2026 23:59".
    const stored = jakartaLocalToIso("2026-11-03T23:59");
    expect(stored).toBe("2026-11-03T23:59:59+07:00");
    expect(normalizeDeadlineIso(stored)).toBe(NOV_3);
    const deadline = getEffectiveRsvpDeadline(
      { rsvpDeadline: GLOBAL },
      { inviteType: { rsvpDeadline: stored } },
    );
    // 23:59:30 WIB is still inside the chosen minute.
    expect(isRsvpClosed(deadline, new Date("2026-11-03T16:59:30.000Z"))).toBe(
      false,
    );
    expect(isRsvpClosed(deadline, new Date("2026-11-03T16:59:59.000Z"))).toBe(
      false,
    );
    expect(isRsvpClosed(deadline, new Date("2026-11-03T16:59:59.001Z"))).toBe(
      true,
    );
    // Open/save round trips are stable, including the live main deadline
    // (12 Oct 23:59:59 WIB), which the editor shows as 23:59.
    expect(isoToJakartaLocal(NOV_3)).toBe("2026-11-03T23:59");
    expect(isoToJakartaLocal(GLOBAL)).toBe("2026-10-12T23:59");
    expect(normalizeDeadlineIso(jakartaLocalToIso(isoToJakartaLocal(GLOBAL)))).toBe(
      GLOBAL,
    );
    expect(jakartaLocalToIso("")).toBe("");
  });

  it("treats +07:00 and Z forms of the same instant as equal", () => {
    const jakarta = "2026-11-03T23:59:59+07:00";
    expect(normalizeDeadlineIso(jakarta)).toBe(normalizeDeadlineIso(NOV_3));
    for (const now of [
      new Date("2026-11-03T16:59:59.000Z"),
      new Date("2026-11-03T16:59:59.001Z"),
    ]) {
      expect(isRsvpClosed(jakarta, now)).toBe(isRsvpClosed(NOV_3, now));
    }
    expect(
      getEffectiveRsvpDeadline(
        { rsvpDeadline: GLOBAL },
        { inviteType: { rsvpDeadline: jakarta } },
      ),
    ).toBe(NOV_3);
  });

  it("toGuestContent strips publicInviteTypes and applies the effective deadline", () => {
    const content = {
      ...weddingContent,
      publicInviteTypes: [...weddingContent.publicInviteTypes, familyAndFriends],
    };
    const guestContent = toGuestContent(content, NOV_3);
    expect(guestContent.publicInviteTypes).toEqual([]);
    expect(guestContent.rsvpDeadline).toBe(NOV_3);
    const serialized = JSON.stringify(guestContent);
    for (const code of ["EJFAMILY", "EJOVERSEAS", "FAMILY-AND-FRIENDS"]) {
      expect(serialized).not.toContain(code);
    }
    // The source content object is not mutated.
    expect(content.publicInviteTypes).toHaveLength(4);
    expect(content.rsvpDeadline).toBe(weddingContent.rsvpDeadline);
  });

  it("formats deadlines as Jakarta calendar dates", () => {
    expect(formatRsvpDeadlineDate(GLOBAL)).toBe("12 October 2026");
    expect(formatRsvpDeadlineDate(NOV_3)).toBe("3 November 2026");
    // 3 Nov 23:59 WIB is still 3 Nov in Jakarta even though it is 16:59Z.
    expect(formatRsvpDeadlineDate("2026-11-03T23:59:00+07:00")).toBe(
      "3 November 2026",
    );
  });

  it("WhatsApp RSVP confirmation shows the invitation's formatted effective deadline", () => {
    const content = { ...weddingContent, rsvpDeadline: GLOBAL };
    // Fixed "now" (4 Oct 2026) so the test does not change after 12 Oct.
    const now = new Date("2026-10-04T05:00:00.000Z");
    const withoutOverride = buildAdminWhatsAppMessage({
      invitation: invitationWith(),
      content,
      messageType: "rsvp_confirmation",
      baseUrl: "https://example.test",
      now,
    });
    expect(withoutOverride).toContain(
      "You may update your RSVP until 12 October 2026.",
    );
    expect(withoutOverride).not.toContain("2026-10-12T16:59:59.000Z");

    const withOverride = buildAdminWhatsAppMessage({
      invitation: invitationWith(NOV_3),
      content,
      messageType: "rsvp_confirmation",
      baseUrl: "https://example.test",
      now,
    });
    expect(withOverride).toContain(
      "You may update your RSVP until 3 November 2026.",
    );
    expect(withOverride).not.toContain(NOV_3);
  });

  it("WhatsApp RSVP confirmation after the effective deadline promises no update date", () => {
    const content = { ...weddingContent, rsvpDeadline: GLOBAL };
    const afterGlobal = new Date("2026-10-12T17:00:00.000Z");
    const closed = buildAdminWhatsAppMessage({
      invitation: invitationWith(),
      content,
      messageType: "rsvp_confirmation",
      baseUrl: "https://example.test",
      now: afterGlobal,
    });
    expect(closed).toContain("If anything changes, just reply to this message.");
    expect(closed).not.toContain("You may update your RSVP");
    // Boundary: the deadline instant itself is still open (strict >).
    expect(
      buildAdminWhatsAppMessage({
        invitation: invitationWith(),
        content,
        messageType: "rsvp_confirmation",
        baseUrl: "https://example.test",
        now: new Date(GLOBAL),
      }),
    ).toContain("You may update your RSVP until 12 October 2026.");
    // A guest with an open extension is still told the extended date.
    expect(
      buildAdminWhatsAppMessage({
        invitation: invitationWith(NOV_3),
        content,
        messageType: "rsvp_confirmation",
        baseUrl: "https://example.test",
        now: afterGlobal,
      }),
    ).toContain("You may update your RSVP until 3 November 2026.");
  });

  it("never builds a personal name code equal to a public link code", () => {
    expect(buildNameInviteCode("Ej Family", [], ["EJFAMILY"])).toBe(
      "EJFAMILY2",
    );
    expect(
      buildNameInviteCode("Family And Friends", [], ["FAMILY-AND-FRIENDS"]),
    ).toBe("FAMILYANDFRIENDS");
    expect(buildNameInviteCode("EJ01", ["EJ012"], ["ej01"])).toBe("EJ013");
    expect(buildNameInviteCode("Jess Married")).toBe("JESSMARRIED2");
  });
});

describe("custom public link navigation (DL-8/DL-9)", () => {
  it("maps codes to short root paths and avoids built-in routes", () => {
    expect(publicLinkShortPath("FAMILY-AND-FRIENDS")).toBe(
      "/family-and-friends",
    );
    expect(publicLinkShortPath("EJ04")).toBe("/ej04");
    // Built-in pages win, so those codes fall back to /invite/<CODE>.
    expect(publicLinkShortPath("ADMIN")).toBe("/invite/ADMIN");
    expect(publicLinkShortPath("FAMILY")).toBe("/invite/FAMILY");
    // ...unless it's the built-in type that owns the route.
    expect(publicLinkShortPath("JESSMARRIED", "generic")).toBe("/jessmarried");
    expect(publicLinkShortPath("JESSMARRIED")).toBe("/invite/JESSMARRIED");
  });

  it("carries custom links as `link`, never as `code`, and keeps default routes", () => {
    const linkCode = customPublicLinkCode(familyAndFriends);
    expect(linkCode).toBe("FAMILY-AND-FRIENDS");
    expect(
      customPublicLinkCode(weddingContent.publicInviteTypes[0]),
    ).toBeUndefined();

    expect(invitationHref(undefined, "generic", linkCode)).toBe(
      "/family-and-friends",
    );
    expect(discoverMedanHref(undefined, "generic", linkCode)).toBe(
      "/discover-medan?flow=generic&link=FAMILY-AND-FRIENDS",
    );
    expect(travelAccommodationHref(undefined, "family", linkCode)).toBe(
      "/travel-accommodation?flow=family&link=FAMILY-AND-FRIENDS",
    );
    // Once the guest has a personal code it wins and `link` is dropped.
    expect(invitationHref("JOHNTAN", "generic", linkCode)).toBe(
      "/invite/JOHNTAN",
    );
    expect(discoverMedanHref("JOHNTAN", "generic", linkCode)).toBe(
      "/discover-medan?code=JOHNTAN",
    );
    // Default links keep their current routes.
    expect(invitationHref(undefined, "generic")).toBe("/jessmarried");
    expect(invitationHref(undefined, "family")).toBe("/family");
    expect(discoverMedanHref(undefined, "overseas")).toBe(
      "/discover-medan?flow=overseas",
    );
  });
});
