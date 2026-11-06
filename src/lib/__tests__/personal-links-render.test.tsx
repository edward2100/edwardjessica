import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpeningCover } from "@/components/site/opening-cover";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { copy } from "@/lib/i18n";
import { NO_RSVP_DEADLINE, toGuestContent } from "@/lib/rsvp";
import type { Language, PersonalInvite, PublicInviteType } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// PL-7: a personal link's page, form and cover. No deadline never closes, so
// these pass the same way on any day.
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
const PENDING: PersonalInvite = {
  code: "JESSMARRIED-2295A3FMJQWX",
  displayName: "Bp. Hadi & Istri",
  guestNames: ["Bp. Hadi", "Istri"],
  maxGuests: 2,
  status: "pending",
  dietary: "",
};

const stubRouter = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
} as unknown as AppRouterInstance;

function personalPage({
  personal = PENDING,
  language = "id",
  openingAnimation = "classic",
}: {
  personal?: PersonalInvite;
  language?: Language;
  openingAnimation?: "classic" | "moongate";
} = {}) {
  const content = {
    ...weddingContent,
    openingAnimation,
    publicInviteTypes: [...weddingContent.publicInviteTypes, SIMPLE],
  };
  return (
    <AppRouterContext.Provider value={stubRouter}>
      <SelfRegisterInvitePage
        content={toGuestContent(content, NO_RSVP_DEADLINE)}
        inviteType={SIMPLE}
        personal={personal}
        initialLanguage={language}
      />
    </AppRouterContext.Provider>
  );
}

function section(html: string, id: string) {
  return html.slice(html.indexOf(`id="${id}"`));
}

describe("personal link page, server-rendered (PL-6)", () => {
  it("greets the guest by name above the couple, large, in the page language", () => {
    const id = renderToStaticMarkup(personalPage());
    expect(id).toContain('<p class="hero-kicker" style="margin-top:34px">Kepada Yth.</p>');
    expect(id).toContain('<p class="hero-guest-name serif">Bp. Hadi &amp; Istri</p>');
    expect(id).not.toContain(copy.id.genericInviteGreeting);
    const en = renderToStaticMarkup(personalPage({ language: "en" }));
    expect(en).toContain('<p class="hero-kicker" style="margin-top:34px">Dear</p>');
    expect(en).toContain("Bp. Hadi &amp; Istri");
  });

  it("puts the name on the moon gate cover", () => {
    const html = renderToStaticMarkup(personalPage({ openingAnimation: "moongate" }));
    expect(html).toMatch(
      /<div class="moongate-guest"><p class="cover-guest-label">Kepada Yth\.<\/p><p class="cover-guest-name serif">Bp\. Hadi &amp; Istri<\/p><\/div>/,
    );
    expect(html).toContain("Ketuk untuk membuka");
  });

  it("asks a pending guest to confirm, and shows a saved answer with a way to change it", () => {
    let html = section(renderToStaticMarkup(personalPage({ language: "en" })), "rsvp");
    expect(html).toContain("Ready to confirm?");
    expect(html).toMatch(/rsvp-main-button[^>]*>[\s\S]*?Confirm Attendance<\/button>/);

    html = section(
      renderToStaticMarkup(personalPage({ personal: { ...PENDING, status: "attending" } })),
      "rsvp",
    );
    expect(html).toContain('<p class="eyebrow">RSVP Anda</p>');
    expect(html).toContain("RSVP diterima");
    expect(html).toContain("Hadir · 2 orang: Bp. Hadi, Istri");
    expect(html).toMatch(/rsvp-main-button[^>]*>[\s\S]*?Ubah jawaban<\/button>/);

    html = section(
      renderToStaticMarkup(
        personalPage({
          personal: { ...PENDING, status: "declined" },
          language: "en",
        }),
      ),
      "rsvp",
    );
    expect(html).toContain("You&#x27;ve let us know you can&#x27;t make it.");
  });
});

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
let container: HTMLDivElement;
let root: Root | null;
const originalScrollIntoView = Element.prototype.scrollIntoView;

function render(element: ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
}

function unmount() {
  act(() => root?.unmount());
  root = null;
}

async function settle() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function rsvpText() {
  return container.querySelector("#rsvp")?.textContent ?? "";
}

function buttonNamed(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!button) throw new Error(`No button "${label}" in: ${rsvpText()}`);
  return button;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
  await settle();
}

async function typeInto(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`No field ${selector}`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  await act(async () => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function choose(selector: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(selector);
  if (!select) throw new Error(`No select ${selector}`);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
  await act(async () => {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function value(selector: string) {
  return container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value;
}

type Call = { url: string; body: Record<string, unknown> };

function stubPersonalApi(reply: (body: Record<string, unknown>) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url: String(input), body });
      return { ok: true, status: 200, json: async () => reply(body) } as Response;
    }),
  );
  return calls;
}

describe("personal link form in the browser (PL-6)", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = () => undefined;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T03:00:00.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(() => {
    unmount();
    container.remove();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    window.sessionStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens prefilled: no name or WhatsApp fields, the party's names, an optional email", async () => {
    render(personalPage({ language: "en", personal: { ...PENDING, dietary: "1 vegetarian" } }));
    await click(buttonNamed("Confirm Attendance"));
    const text = rsvpText();
    expect(text).not.toContain("Your name");
    expect(text).not.toContain("WhatsApp number");
    expect(container.querySelector("#simple-name")).toBeNull();
    expect(container.querySelector("#simple-guest-1")).toBeNull();

    await click(buttonNamed("Yes, I'll attend"));
    expect(rsvpText()).toContain("Number of guests");
    expect(
      [...container.querySelectorAll("#simple-count option")].map((option) => option.textContent),
    ).toEqual(["1", "2"]);
    expect(value("#simple-count")).toBe("2");
    expect(value("#simple-guest-1")).toBe("Bp. Hadi");
    expect(value("#simple-guest-2")).toBe("Istri");
    expect(value("#simple-dietary")).toBe("1 vegetarian");
    expect(rsvpText()).toContain("Email (optional, for a confirmation)");
    expect(container.querySelector("#simple-email")?.hasAttribute("required")).toBe(false);

    // One person: guest 2's field goes; a blank guest 1 is caught first.
    await choose("#simple-count", "1");
    expect(container.querySelector("#simple-guest-2")).toBeNull();
    await typeInto("#simple-guest-1", "");
    const calls = stubPersonalApi(() => ({}));
    await click(buttonNamed("Send RSVP"));
    expect(calls).toEqual([]);
    expect(rsvpText()).toContain("Please enter guest 1's name.");
    expect(document.activeElement?.id).toBe("simple-guest-1");
  });

  it("sends the answer to the personal route, thanks the guest by name, and reopens on the saved answer", async () => {
    const calls = stubPersonalApi((body) => ({
      ok: true,
      late: false,
      emailStatus: "skipped",
      invite: {
        ...PENDING,
        status: "attending",
        guestNames: body.guestNames,
        dietary: body.dietary ?? "",
      },
    }));
    render(personalPage({ language: "en" }));
    await click(buttonNamed("Confirm Attendance"));
    await click(buttonNamed("Yes, I'll attend"));
    await typeInto("#simple-guest-2", "Ibu Wati");
    await typeInto("#simple-dietary", "Vegetarian");
    await click(buttonNamed("Send RSVP"));
    expect(calls).toEqual([
      {
        url: "/api/rsvp/personal",
        body: {
          code: "JESSMARRIED-2295A3FMJQWX",
          attending: true,
          guestCount: 2,
          guestNames: ["Bp. Hadi", "Ibu Wati"],
          dietary: "Vegetarian",
          email: "",
          website: "",
          language: "en",
        },
      },
    ]);
    let text = rsvpText();
    expect(text).toContain("Thank you, Bp. Hadi & Istri!");
    expect(text).toContain("We've received your RSVP for 2 people.");
    expect(text).toContain("You can change your answer on this page.");
    expect(text).not.toContain("Message us on WhatsApp to change");

    await click(buttonNamed("Change my answer"));
    text = rsvpText();
    expect(text).toContain("Your RSVP");
    expect(text).toContain("Attending · 2 people: Bp. Hadi, Ibu Wati");
    expect(buttonNamed("Yes, I'll attend").getAttribute("aria-pressed")).toBe("true");
    expect(value("#simple-guest-2")).toBe("Ibu Wati");
    expect(value("#simple-dietary")).toBe("Vegetarian");
  });
});

describe("personal link cover (PL-6)", () => {
  const labels = copy.id;
  let opened = 0;

  function cover(guestName?: string) {
    return (
      <OpeningCover
        variant="moongate"
        coupleName="Edward & Jessica"
        guestName={guestName}
        language="id"
        onLanguageChange={() => undefined}
        labels={labels}
        onOpened={() => {
          opened += 1;
        }}
        onFirstInteraction={() => undefined}
      />
    );
  }

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
    opened = 0;
  });

  afterEach(() => {
    unmount();
    container.remove();
    window.sessionStorage.clear();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows on every visit, even after the invitation was opened before in the tab", () => {
    window.sessionStorage.setItem("ej-invite-opened", "1");
    render(cover("Bp. Hadi & Istri"));
    expect(container.querySelector(".moongate-guest")?.textContent).toBe(
      "Kepada Yth.Bp. Hadi & Istri",
    );
    unmount();
    // Without a guest the cover keeps today's once-per-tab rule.
    render(cover());
    expect(container.querySelector(".opening-cover")).toBeNull();
    expect(opened).toBe(1);
  });

  it("is skipped once when the guest comes back from one of the site's own pages", () => {
    window.sessionStorage.setItem("ej-invite-return", window.location.pathname);
    render(cover("Bp. Hadi & Istri"));
    expect(container.querySelector(".opening-cover")).toBeNull();
    expect(opened).toBe(1);
    expect(window.sessionStorage.getItem("ej-invite-return")).toBeNull();
    unmount();
    // A refresh after that shows it again.
    render(cover("Bp. Hadi & Istri"));
    expect(container.querySelector(".moongate-guest")).not.toBeNull();
  });

  it("remembers leaving by one of the site's own links, not a click on the same page", async () => {
    render(personalPage({ openingAnimation: "classic" }));
    const away = document.createElement("a");
    away.href = "/discover-medan?code=JESSMARRIED-2295A3FMJQWX";
    away.addEventListener("click", (event) => event.preventDefault());
    const same = document.createElement("a");
    same.href = `${window.location.pathname}#rsvp`;
    same.addEventListener("click", (event) => event.preventDefault());
    container.append(away, same);
    await act(async () => same.click());
    expect(window.sessionStorage.getItem("ej-invite-return")).toBeNull();
    await act(async () => away.click());
    expect(window.sessionStorage.getItem("ej-invite-return")).toBe(window.location.pathname);
  });
});
