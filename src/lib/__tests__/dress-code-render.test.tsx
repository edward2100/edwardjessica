import type { ReactElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DressCodeSection } from "@/components/site/dress-code-section";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { copy } from "@/lib/i18n";
import { toGuestContent, toGuestInvitation } from "@/lib/rsvp";
import { sampleInvitations } from "@/lib/seed";
import type { InvitationGroup, PublicInviteType } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// DC-1: the dinner reception dress code section, a short description.
const FUTURE = "2099-12-31T16:59:59.000Z";
const dinner = weddingContent.events.find((eventItem) => eventItem.key === "dinner")!;
/** The dress code paragraph's text (its nowrap spans removed). */
function textOf(html: string) {
  const start = html.indexOf('<p class="dress-code-text">');
  return html.slice(start, html.indexOf("</p>", start)).replace(/<[^>]+>/g, "");
}

const generalLink: PublicInviteType = {
  id: "general",
  label: { en: "Friends & family", id: "Keluarga & sahabat" },
  code: "JESSMARRIED",
  flow: "generic",
  maxGuests: 2,
  requireGuestNames: false,
  isEnabled: true,
  rsvpDeadline: FUTURE,
};

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

function invitation(code: string, eligibleEvents?: InvitationGroup["eligibleEvents"]) {
  const seed = sampleInvitations.find((item) => item.code === code)!;
  return toGuestInvitation(eligibleEvents ? { ...seed, eligibleEvents } : seed);
}

function invitePage(guest: InvitationGroup) {
  return renderToStaticMarkup(
    <InvitePage content={toGuestContent(weddingContent, FUTURE)} invitation={guest} />,
  );
}

describe("DC-1: dress code section", () => {
  it("English: the dinner's dress code, its time and a short description", () => {
    const html = renderToStaticMarkup(
      <DressCodeSection event={dinner} language="en" labels={copy.en} />,
    );
    expect(html).toContain('id="dress-code"');
    expect(html).toContain('<p class="eyebrow">Dress Code</p>');
    // "Cocktail /" stays together and "Semi-formal" never breaks at its hyphen.
    expect(html).toContain('Cocktail\u00a0/ <span class="dress-code-nowrap">Semi-formal</span>');
    expect(html).toContain("Dinner Reception · 18:30");
    expect(textOf(html)).toBe(copy.en.dressCodeText);
    expect(copy.en.dressCodeText).toContain("cocktail-length or midi dress");
    // "(tie optional)" moves to the next line as a whole. No picture.
    expect(html).toContain('<span class="dress-code-nowrap">(tie optional)</span>');
    expect(html).not.toContain("<img");
  });

  it("Indonesian: the same section in Indonesian", () => {
    const html = renderToStaticMarkup(
      <DressCodeSection event={dinner} language="id" labels={copy.id} />,
    );
    expect(html).toContain('<p class="eyebrow">Aturan Berpakaian</p>');
    expect(html).toContain("Resepsi Makan Malam · 18:30");
    expect(textOf(html)).toBe(copy.id.dressCodeText);
    expect(html).toContain('<span class="dress-code-nowrap">(dasi opsional)</span>');
  });

  it("nothing at all without the dinner", () => {
    expect(
      renderToStaticMarkup(<DressCodeSection language="en" labels={copy.en} />),
    ).toBe("");
  });

  it("public links: right after The Day's Events, before the story and the RSVP", () => {
    const html = renderWithRouter(
      <SelfRegisterInvitePage
        content={toGuestContent(weddingContent, FUTURE)}
        inviteType={generalLink}
      />,
    );
    const schedule = html.indexOf(copy.en.scheduleTitle);
    const dressCode = html.indexOf('id="dress-code"');
    expect(schedule).toBeGreaterThan(-1);
    expect(dressCode).toBeGreaterThan(schedule);
    expect(dressCode).toBeLessThan(html.indexOf("Our Story"));
    expect(dressCode).toBeLessThan(html.indexOf('id="rsvp"'));
  });

  it.each([
    ["simple form (/JESSmarriED)", { form: "simple", path: "JESSmarriED", code: "JESSMARRIED-SIMPLE" }],
    ["overseas", { flow: "overseas", code: "OVERSEAS" }],
    ["family", { flow: "family", code: "EJFAMILY" }],
  ] as const)("the %s link shows it too", (_name, overrides) => {
    const html = renderWithRouter(
      <SelfRegisterInvitePage
        content={toGuestContent(weddingContent, FUTURE)}
        inviteType={{ ...generalLink, ...overrides }}
      />,
    );
    expect(html).toContain('id="dress-code"');
    expect(textOf(html)).toBe(copy.en.dressCodeText);
  });

  it("personal invites: shown to dinner guests, hidden from guests not invited to the dinner", () => {
    const withDinner = invitePage(invitation("EJ26-HARDWIN"));
    expect(withDinner).toContain('id="dress-code"');
    expect(withDinner.indexOf('id="dress-code"')).toBeGreaterThan(
      withDinner.indexOf(copy.en.scheduleTitle),
    );

    const morningOnly = invitePage(invitation("EJ26-HARDWIN", ["holy_matrimony", "tea_lunch"]));
    expect(morningOnly).toContain(copy.en.scheduleTitle);
    expect(morningOnly).not.toContain('id="dress-code"');
  });
});
