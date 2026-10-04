import type { ReactElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvitePage } from "@/components/site/invite-page";
import { RsvpContactLinks } from "@/components/site/rsvp-contact-links";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { TravelAccommodationPage } from "@/components/site/travel-accommodation-page";
import { toGuestContent, toGuestInvitation } from "@/lib/rsvp";
import { sampleInvitations } from "@/lib/seed";
import type { InvitationGroup, PublicInviteType, RsvpContact } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// CL-12: closed-state markup (server render, the same pass that produces the
// HTML guests receive first).
const PAST = "2026-09-30T17:00:00.000Z";
const OWNER_WHATSAPP = "https://wa.me/message/COSKSKIJH7AHP1";

function seed(code: string): InvitationGroup {
  return toGuestInvitation(
    sampleInvitations.find((invitation) => invitation.code === code)!,
  );
}

function closedInvite(code: string, rsvpContact?: RsvpContact) {
  return renderToStaticMarkup(
    <InvitePage
      content={toGuestContent({ ...weddingContent, rsvpContact }, PAST)}
      invitation={seed(code)}
    />,
  );
}

describe("RsvpContactLinks (CL-3)", () => {
  it("renders a new-tab WhatsApp link and a mailto link", () => {
    const html = renderToStaticMarkup(
      <RsvpContactLinks
        contact={{ whatsappUrl: OWNER_WHATSAPP, email: "test@example.com" }}
        language="en"
      />,
    );
    expect(html).toContain(`href="${OWNER_WHATSAPP}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Message us on WhatsApp");
    expect(html).toContain('href="mailto:test@example.com"');
    expect(html).toContain("Email us");
  });

  it("uses the Indonesian label and renders nothing without a valid contact", () => {
    expect(
      renderToStaticMarkup(
        <RsvpContactLinks contact={{ whatsappUrl: OWNER_WHATSAPP }} language="id" />,
      ),
    ).toContain("Hubungi kami via WhatsApp");
    expect(renderToStaticMarkup(<RsvpContactLinks contact={{}} language="en" />)).toBe("");
    expect(
      renderToStaticMarkup(
        <RsvpContactLinks
          contact={{ whatsappUrl: "javascript:alert(1)" }}
          language="en"
        />,
      ),
    ).toBe("");
  });
});

describe("personal invite closed card (CL-1/CL-2/CL-3)", () => {
  it("pending guest: no-RSVP status, contact links, no form button", () => {
    const html = closedInvite("EJ26-HARDWIN", { whatsappUrl: OWNER_WHATSAPP });
    expect(html).toContain("RSVP is now closed");
    expect(html).toContain("We didn&#x27;t receive an RSVP from you before the deadline.");
    expect(html).toContain("If you&#x27;d still like to join us, please get in touch with us:");
    expect(html).toContain(`href="${OWNER_WHATSAPP}"`);
    expect(html).not.toContain("Submit RSVP");
    expect(html).not.toContain("Submit your travel plans");
  });

  it("attending guest: status, guest/event summary and the travel CTA", () => {
    const html = closedInvite("EJ26-BRILIAN", { whatsappUrl: OWNER_WHATSAPP });
    expect(html).toContain("confirmed as attending");
    expect(html).toContain(
      "2 guests attending · Events: Buddhist Wedding Ceremony, Lunch Buffet, Dinner Reception",
    );
    expect(html).toContain("Submit your travel plans →");
    expect(html).toContain('href="/travel-accommodation?code=EJ26-BRILIAN"');
    expect(html).toContain("Need to change anything? Please get in touch with us:");
    expect(html).not.toContain("Update RSVP");
    // The colon sentence is followed by the contact links, not by the CTA.
    const cta = html.indexOf("Submit your travel plans →");
    const reachOut = html.indexOf("Need to change anything?");
    const whatsapp = html.indexOf(`href="${OWNER_WHATSAPP}"`);
    expect(cta).toBeGreaterThan(-1);
    expect(cta).toBeLessThan(reachOut);
    expect(reachOut).toBeLessThan(whatsapp);
  });

  it("declined guest: status, and the generic sentence when no contact is set", () => {
    const html = closedInvite("EJ26-X7K92", {});
    expect(html).toContain("You let us know you can&#x27;t make it — we&#x27;ll miss you.");
    expect(html).toContain("Please contact us directly for any changes.");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Discover Medan</a>");
  });
});

const stubRouter = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
} as unknown as AppRouterInstance;

function renderWithRouter(element: ReactElement) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={stubRouter}>{element}</AppRouterContext.Provider>,
  );
}

const overseasFamilyFriends: PublicInviteType = {
  id: "custom-overseas-family-friends",
  label: { en: "Overseas family & friends", id: "Keluarga & sahabat luar negeri" },
  code: "OVERSEAS-FAMILY-FRIENDS",
  flow: "overseas",
  maxGuests: 1,
  requireGuestNames: false,
  isEnabled: true,
  rsvpDeadline: "2099-11-03T16:59:59.000Z",
};

describe("public link RSVP section (CL-7/CL-8)", () => {
  it("closed link: RSVP eyebrow, contact and 'Already registered?' instead of registration", () => {
    const html = renderWithRouter(
      <SelfRegisterInvitePage
        content={toGuestContent(
          { ...weddingContent, rsvpContact: { whatsappUrl: OWNER_WHATSAPP } },
          PAST,
        )}
        inviteType={overseasFamilyFriends}
      />,
    );
    const rsvpSection = html.slice(html.indexOf('id="rsvp"'));
    expect(rsvpSection).toContain('<p class="eyebrow">RSVP</p>');
    expect(rsvpSection).toContain("RSVP is now closed");
    expect(rsvpSection).toContain("Already registered? Open my invitation");
    expect(rsvpSection).toContain(`href="${OWNER_WHATSAPP}"`);
    expect(rsvpSection).not.toContain("Confirm Attendance");
    expect(rsvpSection).not.toContain("Ready to confirm?");
  });

  it("switched-off link with RSVP still open keeps its original card", () => {
    const html = renderWithRouter(
      <SelfRegisterInvitePage
        content={toGuestContent(
          { ...weddingContent, rsvpContact: { whatsappUrl: OWNER_WHATSAPP } },
          overseasFamilyFriends.rsvpDeadline!,
        )}
        inviteType={{ ...overseasFamilyFriends, isEnabled: false }}
      />,
    );
    const rsvpSection = html.slice(html.indexOf('id="rsvp"'));
    expect(rsvpSection).toContain('<p class="eyebrow">Confirm Attendance</p>');
    expect(rsvpSection).toContain("Registration closed");
    expect(rsvpSection).toContain(
      "Registration for this invitation is no longer available.",
    );
    expect(rsvpSection).not.toContain("RSVP is now closed");
    expect(rsvpSection).not.toContain("Already registered? Open my invitation");
    expect(rsvpSection).not.toContain("wa.me");
  });

  it("switched-off link after the deadline shows the RSVP closed card", () => {
    const html = renderWithRouter(
      <SelfRegisterInvitePage
        content={toGuestContent(
          { ...weddingContent, rsvpContact: { whatsappUrl: OWNER_WHATSAPP } },
          PAST,
        )}
        inviteType={{ ...overseasFamilyFriends, isEnabled: false }}
      />,
    );
    const rsvpSection = html.slice(html.indexOf('id="rsvp"'));
    expect(rsvpSection).toContain("RSVP is now closed");
    expect(rsvpSection).toContain("Already registered? Open my invitation");
    expect(rsvpSection).not.toContain("Registration closed");
  });

  it("open link: registration button and countdown", () => {
    const html = renderWithRouter(
      <SelfRegisterInvitePage
        content={toGuestContent(
          weddingContent,
          overseasFamilyFriends.rsvpDeadline!,
        )}
        inviteType={overseasFamilyFriends}
      />,
    );
    const rsvpSection = html.slice(html.indexOf('id="rsvp"'));
    expect(rsvpSection).toContain("Ready to confirm?");
    expect(rsvpSection).toContain("Confirm Attendance");
    expect(rsvpSection).toMatch(/\d+ days left to RSVP/);
    expect(rsvpSection).not.toContain("RSVP is now closed");
    expect(rsvpSection).not.toContain("Already registered? Open my invitation");
  });
});

function closedTravel(invitation: InvitationGroup, rsvpContact?: RsvpContact) {
  const html = renderWithRouter(
    <TravelAccommodationPage
      content={toGuestContent({ ...weddingContent, rsvpContact }, PAST)}
      flow={invitation.flow}
      invitation={invitation}
      requestedCode={invitation.code}
    />,
  );
  return html.slice(html.indexOf('id="travel-form"'));
}

function closedTravelPage(
  props: Partial<Parameters<typeof TravelAccommodationPage>[0]>,
) {
  return renderWithRouter(
    <TravelAccommodationPage
      content={toGuestContent(
        { ...weddingContent, rsvpContact: { whatsappUrl: OWNER_WHATSAPP } },
        PAST,
      )}
      flow="overseas"
      invitation={null}
      {...props}
    />,
  );
}

function arrivalInput(html: string) {
  return html.match(/<input[^>]*id="travel-arrival"[^>]*>/)?.[0] ?? "";
}

describe("travel page after the deadline (CL-4)", () => {
  it("pending guest: closed copy + contact, no 'RSVP here' link to the closed form", () => {
    const form = closedTravel(seed("EJ26-HARDWIN"), {
      whatsappUrl: OWNER_WHATSAPP,
      email: "test@example.com",
    });
    expect(form).toContain("RSVP is now closed");
    expect(form).toContain("The RSVP deadline has passed");
    expect(form).toContain(`href="${OWNER_WHATSAPP}"`);
    expect(form).toContain('href="mailto:test@example.com"');
    expect(form).not.toContain("RSVP here");
    expect(form).not.toContain("#rsvp");
    expect(form).not.toContain("RSVP first to unlock this form");
  });

  it("declined guest: contact the couple, not 'update your RSVP first'", () => {
    const brilian = seed("EJ26-BRILIAN");
    const form = closedTravel(
      { ...brilian, rsvp: { ...brilian.rsvp, status: "declined" } },
      {},
    );
    expect(form).toContain("No travel details needed");
    expect(form).toContain("If your plans have changed, please contact us directly.");
    expect(form).not.toContain("update your RSVP first");
  });

  it("visitor without a code: closed copy plus a way back to their invitation", () => {
    const html = closedTravelPage({});
    const section = html.slice(html.indexOf('id="travel-form"'));
    expect(section).toContain("The RSVP deadline has passed");
    expect(section).toContain(
      '<a class="travel-inline-link" href="/overseas#rsvp">Already registered? Open my invitation</a>',
    );
    expect(section).not.toContain("RSVP here");
    const custom = closedTravelPage({ linkCode: "OVERSEAS-FAMILY-FRIENDS" });
    expect(custom).toContain('href="/overseas-family-friends#rsvp"');
  });

  it("guest this page does not apply to: notice only, no closed copy", () => {
    const brilian = seed("EJ26-BRILIAN");
    const html = closedTravelPage({
      codeFoundButWrongFlow: true,
      flow: "overseas",
      invitation: { ...brilian, flow: "generic" },
      requestedCode: brilian.code,
    });
    expect(html).toContain("This page is for out-of-town guests");
    const section = html.slice(html.indexOf('id="travel-form"'));
    expect(section).not.toContain("RSVP is now closed");
    expect(section).not.toContain("If you&#x27;d still like to join us");
    expect(section).not.toContain("confirmed their attendance");
    expect(section).not.toContain("Message us on WhatsApp");
    expect(arrivalInput(section)).toContain("disabled");
  });

  it("attending guest: form stays usable", () => {
    const form = closedTravel(seed("EJ26-BRILIAN"), { whatsappUrl: OWNER_WHATSAPP });
    expect(form).not.toContain("RSVP is now closed");
    expect(form).not.toContain("The RSVP deadline has passed");
    expect(arrivalInput(form)).not.toContain("disabled");
    expect(arrivalInput(closedTravel(seed("EJ26-HARDWIN")))).toContain("disabled");
    expect(form).not.toContain("Message us on WhatsApp");
  });
});
