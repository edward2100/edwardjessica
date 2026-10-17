import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverMedanPage } from "@/components/site/discover-medan-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import {
  getDefaultPublicInviteType,
  getEffectiveRsvpDeadline,
  NO_RSVP_DEADLINE,
  toGuestContent,
} from "@/lib/rsvp";
import type {
  Language,
  LateRsvpSetting,
  PublicInviteType,
  RsvpContact,
} from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// SF-7: the simple link's page and form. Dates are fixed (No deadline never
// closes; 2020 is long past) and the browser tests fake the clock, so these
// pass the same way on any day.
const PAST = "2020-01-01T16:59:59.000Z"; // 1 January 2020 23:59:59 WIB
const NOW = new Date("2026-10-20T03:00:00.000Z");
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
// The general link as it is live: standard form, No deadline.
const GENERAL: PublicInviteType = {
  ...getDefaultPublicInviteType(weddingContent),
  rsvpDeadline: NO_RSVP_DEADLINE,
};

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

function linkPage({
  link = SIMPLE,
  lateRsvp = { enabled: false },
  rsvpContact = { whatsappUrl: OWNER_WHATSAPP },
  language,
}: {
  link?: PublicInviteType;
  lateRsvp?: LateRsvpSetting;
  rsvpContact?: RsvpContact;
  language?: Language;
} = {}) {
  const content = {
    ...weddingContent,
    rsvpContact,
    lateRsvp,
    publicInviteTypes: [...weddingContent.publicInviteTypes, SIMPLE],
  };
  return withRouter(
    <SelfRegisterInvitePage
      content={toGuestContent(
        content,
        getEffectiveRsvpDeadline(content, { inviteType: link }),
      )}
      inviteType={link}
      initialLanguage={language}
    />,
  );
}

// Event titles as they appear in the HTML ("Tea Ceremony &amp; Lunch Buffet").
function htmlText(value: string) {
  return value.replace(/&/g, "&amp;");
}

function rsvpSection(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  return html.slice(html.indexOf('id="rsvp"'));
}

describe("simple link page, server-rendered (SF-3)", () => {
  it("shows the same page as the standard link: save-the-date, The Day's Events with times, both calendar buttons", () => {
    const html = renderToStaticMarkup(linkPage());
    expect(html).toContain("Save the Date");
    expect(html).toContain("Saturday");
    expect(html).toContain("12 December 2026");
    expect(html).toContain(`href="${weddingContent.venue.mapsUrl}"`);
    expect(html).toContain('<p class="eyebrow">Schedule</p>');
    expect(html).toContain("The Day’s Events");
    for (const event of weddingContent.events) {
      expect(html).toContain(event.startTime);
      expect(html).toContain(htmlText(event.title.en));
    }
    expect(html.match(/href="\/calendar\.ics"/g)).toHaveLength(2);
    const id = renderToStaticMarkup(linkPage({ language: "id" }));
    expect(id).toContain("Catat Tanggalnya");
    expect(id).toContain("Tambah Kalender");
  });

  it("the open RSVP card is the standard link's card (no date or countdown with No deadline)", () => {
    const html = rsvpSection(linkPage());
    expect(html).toContain('<p class="eyebrow">Confirm Attendance</p>');
    expect(html).toContain("Ready to confirm?");
    expect(html).toContain(
      "Please review the wedding details above before confirming your attendance.",
    );
    expect(html).toMatch(/<button class="button button-primary rsvp-main-button"[^>]*>[\s\S]*?Confirm Attendance<\/button>/);
    expect(html).not.toContain("RSVP by");
    expect(html).not.toMatch(/days? left/);
    expect(html).toBe(rsvpSection(linkPage({ link: GENERAL })));
  });

  it("standard page (no form set) is unchanged: Schedule, times and both calendar buttons", () => {
    const html = renderToStaticMarkup(linkPage({ link: GENERAL }));
    expect(html).toContain('<p class="eyebrow">Schedule</p>');
    expect(html).toContain("The Day’s Events");
    for (const event of weddingContent.events) {
      expect(html).toContain(event.startTime);
      expect(html).toContain(htmlText(event.title.en));
    }
    expect(html.match(/href="\/calendar\.ics"/g)).toHaveLength(2);
  });

  it("closed: the closed card and WhatsApp, never 'Already registered?' (it needs the email code)", () => {
    const html = rsvpSection(
      linkPage({ link: { ...SIMPLE, rsvpDeadline: PAST } }),
    );
    expect(html).toContain("RSVP is now closed");
    expect(html).toContain(`href="${OWNER_WHATSAPP}"`);
    expect(html).not.toContain("Already registered? Open my invitation");
    expect(html).not.toContain("Confirm Attendance");
    // The standard link keeps its lookup.
    expect(
      rsvpSection(linkPage({ link: { ...GENERAL, rsvpDeadline: PAST } })),
    ).toContain("Already registered? Open my invitation");
  });

  it("late: the gold 'Send a late RSVP' and WhatsApp, without 'Already registered?'", () => {
    const html = rsvpSection(
      linkPage({ link: { ...SIMPLE, rsvpDeadline: PAST }, lateRsvp: { enabled: true } }),
    );
    expect(html).toMatch(
      /<button class="button button-brown" type="button"><svg[^>]*lucide-clock[^>]*>[\s\S]*?<\/svg>Send a late RSVP<\/button>/,
    );
    expect(html).toContain(`href="${OWNER_WHATSAPP}"`);
    expect(html).not.toContain("Already registered? Open my invitation");
    const id = rsvpSection(
      linkPage({
        link: { ...SIMPLE, rsvpDeadline: PAST },
        lateRsvp: { enabled: true },
        language: "id",
      }),
    );
    expect(id).toContain("Kirim RSVP terlambat");
    expect(id).not.toContain("Sudah terdaftar? Buka undangan saya");
  });
});

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let container: HTMLDivElement;
let root: Root | null;
const originalScrollIntoView = Element.prototype.scrollIntoView;

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

type FetchCall = { url: string; body: Record<string, unknown> | undefined };

// Answers the page's fetches by URL prefix (longest match wins).
function stubFetch(
  routes: Record<
    string,
    (body: Record<string, unknown> | undefined) => { status?: number; json: unknown }
  >,
) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      calls.push({ url, body });
      const route = Object.keys(routes)
        .filter((prefix) => url.startsWith(prefix))
        .sort((a, b) => b.length - a.length)[0];
      if (!route) throw new Error(`Unexpected fetch: ${url}`);
      const { status = 200, json } = routes[route](body);
      return { ok: status < 400, status, json: async () => json } as Response;
    }),
  );
  return calls;
}

function render(element: ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
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
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
    input,
    value,
  );
  await act(async () => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function choose(selector: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(selector);
  if (!select) throw new Error(`No select ${selector}`);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(
    select,
    value,
  );
  await act(async () => {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function fillContact(name = "Ana Tan", email = "ana@example.com") {
  await typeInto("#simple-name", name);
  await typeInto("#simple-phone", "8123123123");
  await typeInto("#simple-email", email);
}

function simpleReply(overrides: Record<string, unknown> = {}) {
  return () => ({
    json: {
      ok: true,
      existing: false,
      firstName: "Ana",
      status: "attending",
      guestCount: 2,
      emailStatus: "sent",
      late: false,
      ...overrides,
    },
  });
}

describe("simple form in the browser (SF-3)", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("localStorage", memoryStorage());
    Element.prototype.scrollIntoView = () => undefined;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    window.history.replaceState(null, "", window.location.pathname);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("Confirm Attendance opens the simple form straight away: no email code, no session lookup", async () => {
    const calls = stubFetch({});
    render(linkPage());
    await click(buttonNamed("Confirm Attendance"));
    expect(calls).toEqual([]);
    expect(container.querySelector("#guest-otp-email")).toBeNull();
    expect(rsvpText()).not.toContain("Verify your email");
    expect(rsvpText()).toContain("Will you join us?");
    for (const label of ["Your name", "WhatsApp number", "Email address"]) {
      expect(rsvpText()).toContain(label);
    }
    // Accessible names: every field is labelled, the answer is a group.
    expect(container.querySelector("label[for='simple-name']")).not.toBeNull();
    expect(container.querySelector("label[for='simple-email']")).not.toBeNull();
    expect(container.querySelector("#simple-phone")?.getAttribute("aria-labelledby")).toBe(
      "simple-phone-label",
    );
    expect(container.querySelector("#simple-phone-label")?.textContent).toBe("WhatsApp number");
    expect(
      container.querySelector("[role='group']")?.getAttribute("aria-labelledby"),
    ).toBe("simple-attending-label");
    // No events, meals or guest names on this form; count + note only after Yes.
    expect(container.querySelector("#rsvp input[type='checkbox']")).toBeNull();
    expect(rsvpText()).not.toMatch(/Meal preference|Guest names|Plus-one|Events/);
    expect(container.querySelector("#simple-count")).toBeNull();
    expect(container.querySelector("#simple-dietary")).toBeNull();
    // Honeypot: off-screen, out of the tab order, hidden from screen readers.
    const honeypot = container.querySelector<HTMLInputElement>("#simple-website")!;
    expect(honeypot.name).toBe("website");
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.getAttribute("autocomplete")).toBe("off");
    expect(honeypot.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("checks the fields inline, then sends a Yes for 2 people with a dietary note and shows the success screen", async () => {
    let release: () => void = () => undefined;
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return {
          ok: true,
          status: 200,
          json: async () => simpleReply()().json,
        } as Response;
      }),
    );
    render(linkPage());
    await click(buttonNamed("Confirm Attendance"));

    await click(buttonNamed("Send RSVP"));
    expect(calls).toEqual([]);
    for (const message of [
      "Please enter your name.",
      "Please enter your WhatsApp number.",
      "Please enter a valid email address.",
      "Please let us know if you can attend.",
    ]) {
      expect(rsvpText()).toContain(message);
    }
    expect(document.activeElement?.id).toBe("simple-name");
    expect(container.querySelector("#simple-name")?.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector("#simple-name")?.getAttribute("aria-describedby")).toBe(
      "simple-name-error",
    );

    // Errors follow the fields as they are fixed.
    await fillContact("Ana Tan", "ana@example");
    expect(rsvpText()).not.toContain("Please enter your name.");
    expect(rsvpText()).not.toContain("Please enter your WhatsApp number.");
    expect(rsvpText()).toContain("Please enter a valid email address.");
    await typeInto("#simple-email", "ana@example.com");

    await click(buttonNamed("Yes, I'll attend"));
    expect(buttonNamed("Yes, I'll attend").getAttribute("aria-pressed")).toBe("true");
    expect(buttonNamed("Sorry, I can't").getAttribute("aria-pressed")).toBe("false");
    expect(rsvpText()).not.toContain("Please let us know if you can attend.");
    const options = [...container.querySelectorAll("#simple-count option")].map(
      (option) => option.textContent,
    );
    expect(options).toEqual(["1", "2"]);
    expect(rsvpText()).toContain("How many people, including you?");
    expect(rsvpText()).toContain("Dietary requirements (optional)");
    expect(container.querySelector("#simple-dietary")?.getAttribute("placeholder")).toBe(
      "e.g. Vegetarian",
    );
    await choose("#simple-count", "2");
    await typeInto("#simple-dietary", "Vegetarian");

    await click(buttonNamed("Send RSVP"));
    // Disabled while sending.
    const sending = buttonNamed("Saving...");
    expect(sending.disabled).toBe(true);
    expect(calls).toEqual([
      {
        url: "/api/rsvp/simple",
        body: {
          accessCode: "JESSMARRIED-SIMPLE",
          name: "Ana Tan",
          phone: "+62 8123123123",
          email: "ana@example.com",
          attending: true,
          guestCount: 2,
          dietary: "Vegetarian",
          website: "",
          language: "en",
        },
      },
    ]);
    await act(async () => release());
    await settle();

    const text = rsvpText();
    expect(text).toContain("Thank you, Ana!");
    expect(text).toContain("We've received your RSVP for 2 people.");
    expect(text).toContain("Saturday, 12 December 2026");
    expect(text).toContain("Grand City Hall · Medan, Indonesia");
    expect(text).toContain("Need to change anything? Message us on WhatsApp.");
    const rsvp = container.querySelector("#rsvp")!;
    expect(rsvp.querySelector(`a[href="${weddingContent.venue.mapsUrl}"]`)?.textContent).toBe(
      "Open Map",
    );
    expect(rsvp.querySelector(`a[href="${OWNER_WHATSAPP}"]`)?.textContent).toBe(
      "Message us on WhatsApp",
    );
    // The form and the "Ready to confirm?" card are gone; the success screen
    // itself has no calendar file and no invite link (the page above keeps
    // its schedule and calendar buttons).
    expect(container.querySelector("#simple-name")).toBeNull();
    expect(text).not.toContain("Ready to confirm?");
    expect(rsvp.querySelector('a[href="/calendar.ics"]')).toBeNull();
    expect(text).not.toMatch(/View your invite|Add to Calendar|\/invite\//);
  });

  it("Indonesian: errors in Indonesian, then a No and the declined success screen", async () => {
    const calls = stubFetch({
      "/api/rsvp/simple": simpleReply({
        firstName: "Budi",
        status: "declined",
        guestCount: 1,
      }),
    });
    render(linkPage({ language: "id" }));
    await click(buttonNamed("Konfirmasi Kehadiran"));
    expect(rsvpText()).toContain("Apakah Anda akan hadir?");
    expect(rsvpText()).toContain("Nomor WhatsApp");
    await click(buttonNamed("Kirim RSVP"));
    for (const message of [
      "Mohon isi nama Anda.",
      "Mohon isi nomor WhatsApp Anda.",
      "Mohon isi alamat email yang valid.",
      "Mohon beri tahu kami apakah Anda dapat hadir.",
    ]) {
      expect(rsvpText()).toContain(message);
    }
    await fillContact("Budi Santoso", "budi@example.com");
    await click(buttonNamed("Ya, saya hadir"));
    expect(rsvpText()).toContain("Berapa orang yang akan hadir, termasuk Anda?");
    expect(rsvpText()).toContain("Kebutuhan makanan khusus (opsional)");
    expect(container.querySelector("#simple-dietary")?.getAttribute("placeholder")).toBe(
      "mis. Vegetarian",
    );
    await typeInto("#simple-dietary", "Tanpa babi");
    // Changing to No drops the count and the note.
    await click(buttonNamed("Maaf, tidak bisa"));
    expect(container.querySelector("#simple-count")).toBeNull();
    expect(container.querySelector("#simple-dietary")).toBeNull();
    await click(buttonNamed("Kirim RSVP"));

    const sent = calls.find((call) => call.url === "/api/rsvp/simple")!.body!;
    expect(sent).toMatchObject({ attending: false, guestCount: 1, language: "id" });
    expect(sent).not.toHaveProperty("dietary");
    const text = rsvpText();
    expect(text).toContain("Terima kasih, Budi!");
    expect(text).toContain("Terima kasih sudah mengabari kami — kami akan merindukan Anda.");
    expect(text).toContain("Sabtu, 12 Desember 2026");
    expect(text).toContain("Grand City Hall · Medan, Indonesia");
    expect(text).toContain("Buka Peta");
    expect(text).toContain("Ada yang perlu diubah? Kabari kami lewat WhatsApp.");
    expect(text).toContain("Hubungi kami via WhatsApp");
  });

  it("an email that already has an RSVP: thanks and how to change it (EN and ID)", async () => {
    stubFetch({ "/api/rsvp/simple": () => ({ json: { ok: true, existing: true } }) });
    render(linkPage());
    await click(buttonNamed("Confirm Attendance"));
    await fillContact("Ana Tan", "ana@example.com");
    await click(buttonNamed("Sorry, I can't"));
    await click(buttonNamed("Send RSVP"));
    expect(rsvpText()).toContain("Thank you, Ana!");
    expect(rsvpText()).toContain(
      "We already have an RSVP for this email. To change it, message us on WhatsApp.",
    );
    expect(container.querySelector(`#rsvp a[href="${OWNER_WHATSAPP}"]`)).not.toBeNull();
    expect(rsvpText()).not.toContain("We've received your RSVP");
    act(() => root?.unmount());

    render(linkPage({ language: "id" }));
    await click(buttonNamed("Konfirmasi Kehadiran"));
    await fillContact("Ana Tan", "ana@example.com");
    await click(buttonNamed("Maaf, tidak bisa"));
    await click(buttonNamed("Kirim RSVP"));
    expect(rsvpText()).toContain("Terima kasih, Ana!");
    expect(rsvpText()).toContain(
      "Kami sudah menerima RSVP untuk email ini. Untuk mengubahnya, kabari kami lewat WhatsApp.",
    );
  });

  it("without a contact the change line is plain text; a one-person link asks no count", async () => {
    const calls = stubFetch({
      "/api/rsvp/simple": simpleReply({ guestCount: 1 }),
    });
    render(linkPage({ link: { ...SIMPLE, maxGuests: 1 }, rsvpContact: {} }));
    await click(buttonNamed("Confirm Attendance"));
    await fillContact();
    await click(buttonNamed("Yes, I'll attend"));
    expect(container.querySelector("#simple-count")).toBeNull();
    expect(container.querySelector("#simple-dietary")).not.toBeNull();
    await click(buttonNamed("Send RSVP"));
    expect(calls[0].body).toMatchObject({ attending: true, guestCount: 1 });
    expect(rsvpText()).toContain("We've received your RSVP for 1 person.");
    expect(rsvpText()).toContain("Need to change anything? Please contact Edward or Jessica.");
    expect(container.querySelector("#rsvp a[href^='https://wa.me']")).toBeNull();
    expect(container.querySelector("#rsvp a[href^='mailto:']")).toBeNull();
  });

  it("late window: 'Send a late RSVP' opens the simple form with the late notice", async () => {
    const calls = stubFetch({ "/api/rsvp/simple": simpleReply({ late: true }) });
    render(linkPage({ link: { ...SIMPLE, rsvpDeadline: PAST }, lateRsvp: { enabled: true } }));
    await click(buttonNamed("Send a late RSVP"));
    expect(calls).toEqual([]);
    expect(container.querySelector("#guest-otp-email")).toBeNull();
    expect(rsvpText()).toContain(
      "Late RSVP · Our RSVP date was 1 January 2020. We'll confirm your place with you.",
    );
    await fillContact();
    await click(buttonNamed("Yes, I'll attend"));
    await click(buttonNamed("Send RSVP"));
    expect(rsvpText()).toContain("Thank you, Ana!");
    expect(rsvpText()).toContain("We'll be in touch to confirm your place.");
    expect(rsvpText()).not.toContain("Send a late RSVP");
  });

  it("a 403 from the server switches to the closed card", async () => {
    stubFetch({
      "/api/rsvp/simple": () => ({ status: 403, json: { error: "RSVP editing is closed." } }),
    });
    render(linkPage());
    await click(buttonNamed("Confirm Attendance"));
    await fillContact();
    await click(buttonNamed("Yes, I'll attend"));
    await click(buttonNamed("Send RSVP"));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("If you'd still like to join us, please get in touch with us:");
    expect(rsvpText()).not.toContain("Already registered? Open my invitation");
    expect(container.querySelector("#simple-name")).toBeNull();
  });

  it("a #rsvp link opens the simple form without a session lookup", async () => {
    window.history.replaceState(null, "", "#rsvp");
    const calls = stubFetch({});
    render(linkPage());
    await settle();
    expect(calls).toEqual([]);
    expect(container.querySelector("#simple-name")).not.toBeNull();
  });

  it("the menu and Discover Medan return to the custom address", async () => {
    stubFetch({});
    render(linkPage());
    await click(container.querySelector<HTMLButtonElement>(".guest-menu-button")!);
    const links = Object.fromEntries(
      [...container.querySelectorAll<HTMLAnchorElement>(".guest-menu-link")].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]),
    );
    expect(links).toEqual({
      Invitation: "/JESSmarriED",
      "Discover Medan": "/discover-medan?flow=generic&link=JESSMARRIED-SIMPLE",
    });
    act(() => root?.unmount());

    render(
      withRouter(
        <DiscoverMedanPage
          content={toGuestContent(weddingContent, NO_RSVP_DEADLINE)}
          flow="generic"
          invitation={null}
          linkCode="JESSMARRIED-SIMPLE"
          linkPath="JESSmarriED"
        />,
      ),
    );
    await click(container.querySelector<HTMLButtonElement>(".guest-menu-button")!);
    const invitation = [...container.querySelectorAll<HTMLAnchorElement>(".guest-menu-link")].find(
      (link) => link.textContent === "Invitation",
    );
    expect(invitation?.getAttribute("href")).toBe("/JESSmarriED");
  });

  it("the standard link is unchanged: Confirm Attendance checks the session, then asks for the email code", async () => {
    const calls = stubFetch({
      "/api/guest-auth/resolve-invite": () => ({ json: { verified: false } }),
    });
    render(linkPage({ link: GENERAL }));
    await click(buttonNamed("Confirm Attendance"));
    expect(calls.map((call) => call.url)).toEqual([
      "/api/guest-auth/resolve-invite?flow=generic",
    ]);
    expect(container.querySelector("#guest-otp-email")).not.toBeNull();
    expect(rsvpText()).toContain("Verify your email");
    expect(container.querySelector("#simple-name")).toBeNull();
  });

  it("server HTML and hydration agree (EN, ID, late)", () => {
    for (const element of [
      linkPage(),
      linkPage({ language: "id" }),
      linkPage({ link: { ...SIMPLE, rsvpDeadline: PAST }, lateRsvp: { enabled: true } }),
    ]) {
      const host = document.createElement("div");
      host.innerHTML = renderToString(element);
      document.body.appendChild(host);
      const serverText = host.textContent;
      const recoverableErrors: unknown[] = [];
      let hydrated: Root | undefined;
      act(() => {
        hydrated = hydrateRoot(host, element, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        });
      });
      expect(recoverableErrors).toEqual([]);
      expect(host.textContent).toBe(serverText);
      act(() => hydrated?.unmount());
      host.remove();
    }
  });
});
