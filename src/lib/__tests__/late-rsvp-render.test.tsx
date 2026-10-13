import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { TravelAccommodationPage } from "@/components/site/travel-accommodation-page";
import {
  getDefaultPublicInviteType,
  toGuestContent,
  toGuestInvitation,
} from "@/lib/rsvp";
import { sampleInvitations } from "@/lib/seed";
import type {
  InvitationGroup,
  Language,
  LateRsvpSetting,
  PublicInviteType,
  RsvpContact,
} from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// LR-5: late-window markup and flows. The clock is always faked, so these
// pass the same way before and after 3 Nov 2026.
const GLOBAL = "2026-10-12T16:59:59.000Z"; // 12 Oct 2026 23:59:59 WIB
const NOV_3 = "2026-11-03T16:59:59.000Z"; // 3 Nov 2026 23:59:59 WIB
const NOW = new Date("2026-10-20T03:00:00.000Z"); // deadline passed, late open
const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_WHATSAPP = "https://wa.me/message/COSKSKIJH7AHP1";
const LATE_OPEN: LateRsvpSetting = { enabled: true, until: NOV_3 };
const LATE_OFF: LateRsvpSetting = { enabled: false };
const LATE_ENDED: LateRsvpSetting = {
  enabled: true,
  until: "2026-10-15T16:59:59.000Z",
};
// The gold filled late button: .button-brown, clock icon, label.
const LATE_BUTTON =
  /<button class="button button-brown" type="button"><svg[^>]*lucide-clock[^>]*>[\s\S]*?<\/svg>Send a late RSVP<\/button>/;
const LATE_BUTTON_ID =
  /<button class="button button-brown" type="button"><svg[^>]*lucide-clock[^>]*>[\s\S]*?<\/svg>Kirim RSVP terlambat<\/button>/;

function guestContent({
  deadline = GLOBAL,
  lateRsvp = LATE_OPEN,
  rsvpContact = { whatsappUrl: OWNER_WHATSAPP },
}: {
  deadline?: string;
  lateRsvp?: LateRsvpSetting;
  rsvpContact?: RsvpContact;
} = {}) {
  return toGuestContent({ ...weddingContent, rsvpContact, lateRsvp }, deadline);
}

function seed(code: string): InvitationGroup {
  return toGuestInvitation(
    sampleInvitations.find((invitation) => invitation.code === code)!,
  );
}

function declinedBrilian(): InvitationGroup {
  const brilian = seed("EJ26-BRILIAN");
  return {
    ...brilian,
    rsvp: { ...brilian.rsvp, status: "declined", eventAttendance: {} },
  };
}

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

const generic = getDefaultPublicInviteType(weddingContent);

function invitePage(
  invitation: InvitationGroup,
  content = guestContent(),
  initialLanguage?: Language,
) {
  return (
    <InvitePage
      content={content}
      invitation={invitation}
      initialLanguage={initialLanguage}
    />
  );
}

function publicPage(
  content = guestContent(),
  inviteType: PublicInviteType = generic,
  initialLanguage?: Language,
) {
  return withRouter(
    <SelfRegisterInvitePage
      content={content}
      inviteType={inviteType}
      initialLanguage={initialLanguage}
    />,
  );
}

function travelPage(
  invitation: InvitationGroup | null,
  content = guestContent(),
  props: Partial<Parameters<typeof TravelAccommodationPage>[0]> = {},
) {
  return withRouter(
    <TravelAccommodationPage
      content={content}
      flow={invitation?.flow ?? "overseas"}
      invitation={invitation}
      requestedCode={invitation?.code}
      {...props}
    />,
  );
}

function rsvpSection(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  return html.slice(html.indexOf('id="rsvp"'));
}

function travelSection(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  return html.slice(html.indexOf('id="travel-form"'));
}

describe("server-rendered late window (LR-4)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("public link card (A)", () => {
    it("closed heading, the late sentence, then [late RSVP] · [WhatsApp] · [Already registered?]", () => {
      const html = rsvpSection(publicPage());
      expect(html).toContain('<p class="eyebrow">RSVP</p>');
      expect(html).toContain("RSVP is now closed");
      expect(html).toContain(
        "Missed the date? You can still send a late RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      expect(html).toMatch(LATE_BUTTON);
      const late = html.indexOf("Send a late RSVP");
      const whatsapp = html.indexOf(`href="${OWNER_WHATSAPP}"`);
      const already = html.indexOf("Already registered? Open my invitation");
      expect(late).toBeGreaterThan(-1);
      expect(late).toBeLessThan(whatsapp);
      expect(whatsapp).toBeLessThan(already);
      expect(html).toContain("Message us on WhatsApp");
      expect(html).not.toContain("Confirm Attendance");
      expect(html).not.toContain("Ready to confirm?");
      expect(html).not.toMatch(/days? left/);
      // LR-7: the late end date is not shown to guests.
      expect(html).not.toContain("3 November");
    });

    it("Indonesian copy", () => {
      const html = rsvpSection(publicPage(guestContent(), generic, "id"));
      expect(html).toContain("RSVP telah ditutup");
      expect(html).toContain(
        "Terlewat batas waktu? Anda masih dapat mengirim RSVP terlambat. Jika Anda mengirimnya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
      );
      expect(html).toMatch(LATE_BUTTON_ID);
      expect(html).toContain("Hubungi kami via WhatsApp");
      expect(html).toContain("Sudah terdaftar? Buka undangan saya");
    });

    it("no end date, and no contact set", () => {
      expect(rsvpSection(publicPage(guestContent({ lateRsvp: { enabled: true } })))).toContain(
        "Missed the date? You can still send a late RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      const noContact = rsvpSection(publicPage(guestContent({ rsvpContact: {} })));
      expect(noContact).toContain(
        "Missed the date? You can still send a late RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      expect(noContact).not.toContain("get in touch");
      expect(noContact).not.toContain("wa.me");
      expect(noContact).toMatch(LATE_BUTTON);
    });

    it("a switched-off link takes no late registrations: same closed card as with late RSVPs off", () => {
      const disabled = { ...generic, isEnabled: false };
      const html = rsvpSection(publicPage(guestContent(), disabled));
      expect(html).toContain("RSVP is now closed");
      expect(html).not.toContain("late RSVP");
      expect(html).toBe(rsvpSection(publicPage(guestContent({ lateRsvp: LATE_OFF }), disabled)));
    });
  });

  describe("personal invite card (B)", () => {
    it("never replied: status line, late sentence, gold [Send a late RSVP] then WhatsApp", () => {
      const html = rsvpSection(invitePage(seed("EJ26-HARDWIN")));
      expect(html).toContain("RSVP is now closed");
      expect(html).toContain("We didn&#x27;t receive an RSVP from you before the deadline.");
      expect(html).toContain(
        "You can still send a late RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      expect(html).toMatch(LATE_BUTTON);
      expect(html.indexOf("Send a late RSVP")).toBeLessThan(
        html.indexOf(`href="${OWNER_WHATSAPP}"`),
      );
      expect(html).not.toContain("Submit RSVP");
      expect(html).not.toContain("Update my RSVP");
    });

    it("attending: summary and the gold travel CTA, then a gold OUTLINE [Update my RSVP] and WhatsApp", () => {
      const html = rsvpSection(invitePage(seed("EJ26-BRILIAN")));
      expect(html).toContain("confirmed as attending");
      expect(html).toContain(
        "2 guests attending · Events: Buddhist Wedding Ceremony, Lunch Buffet, Dinner Reception",
      );
      expect(html).toContain(
        '<a class="button button-brown" href="/travel-accommodation?code=EJ26-BRILIAN">Submit your travel plans →</a>',
      );
      expect(html).toContain(
        "Need to change anything? You can still update your RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      expect(html).toMatch(
        /<button class="button button-gold-outline" type="button"><svg[^>]*lucide-clock[^>]*>[\s\S]*?<\/svg>Update my RSVP<\/button>/,
      );
      // Only the travel CTA is filled gold.
      expect(html.match(/button-brown/g)).toHaveLength(1);
      const cta = html.indexOf("Submit your travel plans →");
      const reachOut = html.indexOf("Need to change anything?");
      const update = html.indexOf("Update my RSVP");
      const whatsapp = html.indexOf(`href="${OWNER_WHATSAPP}"`);
      expect(cta).toBeLessThan(reachOut);
      expect(reachOut).toBeLessThan(update);
      expect(update).toBeLessThan(whatsapp);
      expect(html).not.toContain("Send a late RSVP");
    });

    it("declined: status line and the outline [Update my RSVP]", () => {
      const html = rsvpSection(invitePage(seed("EJ26-X7K92")));
      expect(html).toContain("You let us know you can&#x27;t make it — we&#x27;ll miss you.");
      expect(html).toContain(
        "Need to change anything? You can still update your RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      expect(html).toContain('class="button button-gold-outline"');
      expect(html).not.toContain("button-brown");
    });

    it("Indonesian copy, no end date and no contact", () => {
      const pending = rsvpSection(invitePage(seed("EJ26-HARDWIN"), guestContent(), "id"));
      expect(pending).toContain(
        "Anda masih dapat mengirim RSVP terlambat. Jika Anda mengirimnya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
      );
      expect(pending).toMatch(LATE_BUTTON_ID);
      const attending = rsvpSection(invitePage(seed("EJ26-BRILIAN"), guestContent(), "id"));
      expect(attending).toContain(
        "Ada yang perlu diubah? Anda masih dapat memperbarui RSVP. Jika Anda memperbaruinya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
      );
      expect(attending).toContain("Perbarui RSVP saya");
      expect(
        rsvpSection(invitePage(seed("EJ26-HARDWIN"), guestContent({ lateRsvp: { enabled: true } }))),
      ).toContain("You can still send a late RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.");
      const noContact = rsvpSection(
        invitePage(seed("EJ26-BRILIAN"), guestContent({ rsvpContact: {} })),
      );
      expect(noContact).toContain(
        "Need to change anything? You can still update your RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
      );
      expect(noContact).not.toContain("Please contact us directly for any changes.");
    });
  });

  describe("outside the late window nothing changes (E)", () => {
    const pages = (content: ReturnType<typeof guestContent>) => [
      renderToStaticMarkup(invitePage(seed("EJ26-HARDWIN"), content)),
      renderToStaticMarkup(invitePage(seed("EJ26-BRILIAN"), content)),
      renderToStaticMarkup(invitePage(seed("EJ26-X7K92"), content, "id")),
      renderToStaticMarkup(publicPage(content)),
      renderToStaticMarkup(publicPage(content, generic, "id")),
      renderToStaticMarkup(travelPage(seed("EJ26-HARDWIN"), content)),
      renderToStaticMarkup(travelPage(declinedBrilian(), content)),
      renderToStaticMarkup(travelPage(null, content)),
    ];

    it("late RSVPs ended: exactly the closed pages of late RSVPs switched off", () => {
      const ended = pages(guestContent({ lateRsvp: LATE_ENDED }));
      expect(ended).toEqual(pages(guestContent({ lateRsvp: LATE_OFF })));
      for (const html of ended) {
        expect(html).not.toMatch(/late RSVP|RSVP terlambat|Update my RSVP|button-gold-outline/);
      }
      expect(ended[0]).toContain("If you&#x27;d still like to join us, please get in touch with us:");
    });

    it("before the deadline the late setting changes nothing (countdown, Confirm Attendance)", () => {
      const open = pages(guestContent({ deadline: NOV_3 }));
      expect(open).toEqual(pages(guestContent({ deadline: NOV_3, lateRsvp: LATE_OFF })));
      expect(open).toEqual(
        pages(guestContent({ deadline: NOV_3, lateRsvp: { enabled: true } })),
      );
      expect(open[3]).toContain("Confirm Attendance");
      expect(open[3]).toContain("15 days left to RSVP");
      expect(open[0]).toContain("Kindly confirm your presence");
      for (const html of open) {
        expect(html).not.toMatch(/late RSVP|RSVP terlambat|RSVP is now closed/);
      }
    });
  });

  describe("travel page (D)", () => {
    it("never replied: locked copy plus a gold inline 'Send a late RSVP' link to their invite", () => {
      const form = travelSection(travelPage(seed("EJ26-HARDWIN")));
      expect(form).toContain("RSVP first to unlock this form");
      expect(form).toContain(
        'This page can be viewed anytime, but travel details can only be submitted after your RSVP has been received. <a class="travel-inline-link" href="/invite/EJ26-HARDWIN#rsvp">Send a late RSVP</a>',
      );
      expect(form).not.toContain("RSVP here");
      expect(form).not.toContain("The RSVP deadline has passed");
      expect(form).not.toContain("Message us on WhatsApp");
    });

    it("visitors without a code get the link to the public page's #rsvp", () => {
      expect(travelSection(travelPage(null))).toContain(
        '<a class="travel-inline-link" href="/overseas#rsvp">Send a late RSVP</a>',
      );
      expect(
        travelSection(travelPage(null, guestContent(), { linkCode: "OVERSEAS-FAMILY-FRIENDS" })),
      ).toContain('href="/overseas-family-friends#rsvp">Send a late RSVP</a>');
      expect(travelSection(travelPage(null, guestContent(), {}))).not.toContain(
        "Already registered? Open my invitation",
      );
    });

    it("declined: can still update the RSVP, and is asked to tell Edward or Jessica", () => {
      const form = travelSection(travelPage(declinedBrilian()));
      expect(form).toContain("No travel details needed");
      expect(form).toContain(
        'If your plans have changed, you can still update your RSVP. If you do, we&#x27;d appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too. <a class="travel-inline-link" href="/invite/EJ26-BRILIAN#rsvp">Update my RSVP</a>',
      );
      expect(form).not.toContain("please contact us directly");
      const id = travelSection(
        withRouter(
          <TravelAccommodationPage
            content={guestContent()}
            flow="family"
            invitation={declinedBrilian()}
            requestedCode="EJ26-BRILIAN"
            initialLanguage="id"
          />,
        ),
      );
      expect(id).toContain(
        "Jika rencana Anda berubah, Anda masih dapat memperbarui RSVP. Jika Anda memperbaruinya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
      );
      expect(id).toContain(">Perbarui RSVP saya</a>");
    });

    it("attending guests keep a usable form; a guest the page doesn't apply to gets no late link", () => {
      const attending = travelSection(travelPage(seed("EJ26-BRILIAN")));
      expect(attending.match(/<input[^>]*id="travel-arrival"[^>]*>/)?.[0]).not.toContain(
        "disabled",
      );
      expect(attending).not.toContain("Send a late RSVP");
      const brilian = seed("EJ26-BRILIAN");
      const wrongFlow = renderToStaticMarkup(
        travelPage({ ...brilian, flow: "generic" }, guestContent(), {
          codeFoundButWrongFlow: true,
          flow: "overseas",
        }),
      );
      expect(wrongFlow).toContain("This page is for out-of-town guests");
      expect(wrongFlow.slice(wrongFlow.indexOf('id="travel-form"'))).not.toMatch(
        /late RSVP|RSVP first to unlock/,
      );
    });
  });
});

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let container: HTMLDivElement;
let root: Root | null;
const originalScrollIntoView = Element.prototype.scrollIntoView;

// In-memory localStorage: the pages store the invite code, and the test
// runner's own localStorage global is not usable here.
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
  routes: Record<string, (body: Record<string, unknown> | undefined) => { status?: number; json: unknown }>,
) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
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
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!input) throw new Error(`No field ${selector}`);
  const prototype =
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  await act(async () => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function choose(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
  await act(async () => {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("late RSVP in the browser (LR-4)", () => {
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("public link (A): late registration through the same email check and form, with the late notice", async () => {
    let verified = false;
    const calls = stubFetch({
      "/api/guest-auth/resolve-invite": () => ({
        json: verified
          ? { verified: true, email: "late.guest@example.com", invitation: null }
          : { verified: false },
      }),
      "/api/guest-auth/send-otp": () => ({ json: { ok: true } }),
      "/api/guest-auth/verify": (body) => {
        verified = true;
        return { json: { email: body?.email } };
      },
      "/api/rsvp/self-register": (body) => ({
        json: {
          invitation: {
            ...seed("EJ26-X7K92"),
            id: "invite-late-guest",
            code: "LATEGUEST",
            groupName: String(body?.name),
            source: "generic",
            rsvp: {
              id: "rsvp-late-guest",
              invitationGroupId: "invite-late-guest",
              status: "attending",
              eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
            },
            guests: [
              {
                id: "guest-late-guest",
                invitationGroupId: "invite-late-guest",
                name: String(body?.name),
                mealPreference: "vegetarian",
              },
            ],
          },
          existing: false,
          emailStatus: "sent",
          late: true,
        },
      }),
    });
    render(publicPage());

    await click(buttonNamed("Send a late RSVP"));
    expect(calls[0].url).toBe("/api/guest-auth/resolve-invite?flow=generic");
    expect(rsvpText()).toContain(
      "Late RSVP · Our RSVP date was 12 October 2026. We'll confirm your place with you.",
    );
    expect(rsvpText()).toContain("Verify your email");

    await typeInto("#guest-otp-email", "late.guest@example.com");
    await click(buttonNamed("Send code"));
    await typeInto("#guest-otp-token", "123456");
    await click(buttonNamed("Verify code"));

    // The registration form is fully usable in the late window.
    const submit = buttonNamed("Send RSVP");
    expect(submit.disabled).toBe(false);
    expect(rsvpText()).not.toContain("RSVP editing is closed.");
    await typeInto("#self-name", "Late Guest");
    await typeInto("#self-phone", "8123123123");
    await click(submit);

    const registration = calls.find((call) => call.url === "/api/rsvp/self-register");
    expect(registration?.body).toMatchObject({
      accessCode: "JESSMARRIED",
      name: "Late Guest",
      phone: "+62 8123123123",
      status: "attending",
    });
    expect(rsvpText()).toContain("Thank you — we've received your late RSVP.");
    expect(rsvpText()).toContain("We'll be in touch to confirm your place.");
    expect(rsvpText()).toContain(
      "Please also give Edward or Jessica a quick heads-up on Telegram or WhatsApp.",
    );
    expect(rsvpText()).not.toContain("your RSVP is confirmed");
    expect(rsvpText()).not.toContain("Send a late RSVP");
  });

  it("public link (A): an email with no invitation found by 'Already registered?' can go on to a late RSVP", async () => {
    let verified = false;
    stubFetch({
      "/api/guest-auth/resolve-invite": () => ({
        json: verified
          ? { verified: true, email: "nobody@example.com", invitation: null }
          : { verified: false },
      }),
      "/api/guest-auth/send-otp": () => ({ json: { ok: true } }),
      "/api/guest-auth/verify": (body) => {
        verified = true;
        return { json: { email: body?.email } };
      },
    });
    render(publicPage());
    await click(buttonNamed("Already registered? Open my invitation"));
    await typeInto("#guest-otp-email", "nobody@example.com");
    await click(buttonNamed("Send code"));
    await typeInto("#guest-otp-token", "123456");
    await click(buttonNamed("Verify code"));
    expect(rsvpText()).toContain(
      "We couldn't find an invitation for this email. You can still send a late RSVP with it.",
    );
    expect(rsvpText()).not.toContain("new registrations are no longer possible");
    const buttons = [...container.querySelectorAll("#closed-lookup button")].map(
      (button) => button.textContent,
    );
    expect(buttons).toEqual(["Send a late RSVP", "Try another email"]);

    await click(container.querySelector<HTMLButtonElement>("#closed-lookup button")!);
    // Straight to the form, no second code.
    expect(container.querySelector("#closed-lookup")).toBeNull();
    expect(container.querySelector("#self-name")).not.toBeNull();
    expect(rsvpText()).toContain("Late RSVP · Our RSVP date was 12 October 2026.");
  });

  it("personal invite (B): a never-replied guest sends a late RSVP, sees the late success, then the late card again", async () => {
    const hardwin = seed("EJ26-HARDWIN");
    const calls = stubFetch({
      "/api/guest-auth/status": () => ({
        json: { verified: true, email: "hardwin.family@example.com" },
      }),
      "/api/rsvp": (body) => ({
        json: {
          invitation: {
            ...hardwin,
            rsvp: {
              ...hardwin.rsvp,
              status: "attending",
              eventAttendance: { holy_matrimony: true, tea_lunch: true, dinner: true },
              submittedAt: NOW.toISOString(),
            },
            guests: hardwin.guests.map((guest) => ({
              ...guest,
              mealPreference: (body?.mealPreferences as Record<string, string>)[guest.id],
            })),
          },
          emailStatus: "sent",
          late: true,
        },
      }),
    });
    render(invitePage(hardwin));

    await click(buttonNamed("Send a late RSVP"));
    expect(rsvpText()).toContain(
      "Late RSVP · Our RSVP date was 12 October 2026. We'll confirm your place with you.",
    );
    // Same email check as the open state: the claimed invite verifies the session.
    expect(calls[0].url).toBe("/api/guest-auth/status?code=EJ26-HARDWIN");
    const form = container.querySelector("#rsvp-form form")!;
    const controls = [...form.querySelectorAll("input, select, textarea, button")];
    expect(controls.length).toBeGreaterThan(5);
    expect(controls.filter((control) => (control as HTMLInputElement).disabled)).toEqual([]);

    const meals = [...form.querySelectorAll<HTMLSelectElement>(".guest-meal-row select")];
    await choose(meals[0], "vegetarian");
    await choose(meals[1], "non_vegetarian");
    await click(buttonNamed("Submit RSVP"));

    const rsvp = calls.find((call) => call.url === "/api/rsvp");
    // LR-6: the primary guest's meal is in mealPreferences; the second guest
    // has one editable row, sent as an additional guest with their id.
    expect(rsvp?.body).toMatchObject({
      code: "EJ26-HARDWIN",
      status: "attending",
      mealPreferences: { "guest-hardwin-1": "vegetarian" },
      additionalGuests: [
        { id: "guest-hardwin-2", name: "Masria Ang", mealPreference: "non_vegetarian" },
      ],
    });
    expect(rsvpText()).toContain("Thank you — we've received your late RSVP.");
    expect(rsvpText()).toContain("We'll be in touch to confirm your place.");
    expect(rsvpText()).not.toContain("your RSVP is confirmed");
    expect(rsvpText()).not.toContain("RSVP is now closed");

    // "Update RSVP" brings back the late card, now for an attending guest.
    await click(buttonNamed("Update RSVP"));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("You're confirmed as attending");
    expect(buttonNamed("Update my RSVP").className).toBe("button button-gold-outline");
    expect(rsvpText()).toContain(
      "Late change · Our RSVP date was 12 October 2026. We'll confirm the change with you.",
    );
  });

  it("RSVP form (LR-6): each guest is listed once, extra slots are numbered after them, and a second guest's meal change is sent", async () => {
    const brilian = { ...seed("EJ26-BRILIAN"), emailClaimed: true };
    const calls = stubFetch({
      "/api/guest-auth/status": () => ({
        json: { verified: true, email: "brilian@example.com" },
      }),
      "/api/rsvp": () => ({ json: { invitation: brilian, emailStatus: "sent", late: true } }),
    });
    render(invitePage(brilian));
    await click(buttonNamed("Update my RSVP"));
    const form = container.querySelector("#rsvp-form form")!;

    // Fixed meal rows: only the primary guest. Janice is one editable row.
    const fixedNames = [...form.querySelectorAll(".guest-meal-row > span")].map(
      (span) => span.textContent,
    );
    expect(fixedNames).toEqual(["Brilian Moktar"]);
    const nameInputs = [
      ...form.querySelectorAll<HTMLInputElement>(".guest-meal-row > input"),
    ];
    expect(nameInputs.filter((input) => input.value === "Janice Jong")).toHaveLength(1);
    // 6 max - 2 guests = 4 blank slots, numbered Guest 3-6 (not 4-7).
    expect(
      nameInputs.filter((input) => !input.value).map((input) => input.placeholder),
    ).toEqual(["Guest 3 name", "Guest 4 name", "Guest 5 name", "Guest 6 name"]);

    // Janice's meal is changed in her (only) row and that value is submitted.
    const janiceRow = nameInputs.find((input) => input.value === "Janice Jong")!
      .parentElement!;
    await choose(janiceRow.querySelector("select")!, "non_vegetarian");
    await click(buttonNamed("Update RSVP"));
    const rsvp = calls.find((call) => call.url === "/api/rsvp");
    expect(rsvp?.body?.additionalGuests).toEqual([
      { id: "guest-brilian-2", name: "Janice Jong", mealPreference: "non_vegetarian" },
    ]);
  });

  it("personal invite (B): a late decline gets the usual decline heading and no 'we'll confirm' line", async () => {
    const hardwin = seed("EJ26-HARDWIN");
    stubFetch({
      "/api/guest-auth/status": () => ({
        json: { verified: true, email: "hardwin.family@example.com" },
      }),
      "/api/rsvp": () => ({
        json: {
          invitation: {
            ...hardwin,
            rsvp: {
              ...hardwin.rsvp,
              status: "declined",
              eventAttendance: {},
              submittedAt: NOW.toISOString(),
            },
          },
          emailStatus: "sent",
          late: true,
        },
      }),
    });
    render(invitePage(hardwin));
    await click(buttonNamed("Send a late RSVP"));
    await click(buttonNamed("Submit RSVP"));
    expect(rsvpText()).toContain("Thank you for letting us know — we will miss you.");
    expect(rsvpText()).not.toContain("We'll be in touch to confirm");
    expect(rsvpText()).not.toContain("received your late RSVP");
  });

  it("personal invite (B): a 403 from the server switches to the fully closed card", async () => {
    stubFetch({
      "/api/guest-auth/status": () => ({
        json: { verified: true, email: "hardwin.family@example.com" },
      }),
      "/api/rsvp": () => ({ status: 403, json: { error: "RSVP editing is closed." } }),
    });
    render(invitePage(seed("EJ26-HARDWIN")));
    await click(buttonNamed("Send a late RSVP"));
    await click(buttonNamed("Submit RSVP"));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("If you'd still like to join us, please get in touch with us:");
    expect(rsvpText()).not.toContain("Send a late RSVP");
    expect(container.querySelector("#rsvp-form")).toBeNull();
  });

  it("floating RSVP button (C): shown when open or late, hidden only when closed", async () => {
    for (const [content, expected] of [
      [guestContent({ deadline: NOV_3 }), true],
      [guestContent(), true],
      [guestContent({ lateRsvp: LATE_OFF }), false],
    ] as const) {
      render(invitePage(seed("EJ26-HARDWIN"), content));
      await click(buttonNamed("Open Invitation"));
      expect(Boolean(container.querySelector(".floating-rsvp-button"))).toBe(expected);
      act(() => root?.unmount());
    }
    root = null;
  });

  it("switches open -> late at the deadline, without a reload", () => {
    vi.setSystemTime(new Date(Date.parse(GLOBAL) - 90_000));
    render(invitePage(seed("EJ26-HARDWIN")));
    expect(rsvpText()).toContain("Kindly confirm your presence");
    expect(rsvpText()).toContain("RSVP closes soon — 1 day left");
    act(() => vi.advanceTimersByTime(90_000));
    // The deadline instant itself is still open (strict >).
    expect(rsvpText()).toContain("Kindly confirm your presence");
    act(() => vi.advanceTimersByTime(1));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("Send a late RSVP");
    expect(rsvpText()).not.toContain("day left");
  });

  it("switches late -> closed when late RSVPs end: on the timer, or on focus after the device slept", () => {
    vi.setSystemTime(new Date(Date.parse(NOV_3) - 90_000));
    render(invitePage(seed("EJ26-HARDWIN")));
    expect(rsvpText()).toContain("Send a late RSVP");
    act(() => vi.advanceTimersByTime(90_001));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("If you'd still like to join us, please get in touch with us:");
    expect(rsvpText()).not.toContain("Send a late RSVP");
    act(() => root?.unmount());

    vi.setSystemTime(new Date(Date.parse(NOV_3) - 1000));
    render(publicPage());
    expect(rsvpText()).toContain("Send a late RSVP");
    // The wall clock jumps past the end without the timer firing.
    vi.setSystemTime(new Date(Date.parse(NOV_3) + 60_000));
    expect(rsvpText()).toContain("Send a late RSVP");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(rsvpText()).toContain("Already registered? Open my invitation");
    expect(rsvpText()).not.toContain("Send a late RSVP");
  });

  it("no end date: late RSVPs never close and no end-of-window timer is set", () => {
    render(publicPage(guestContent({ lateRsvp: { enabled: true } })));
    expect(rsvpText()).toContain("Send a late RSVP");
    expect(vi.getTimerCount()).toBe(0);
    act(() => root?.unmount());
    vi.setSystemTime(new Date(NOW.getTime() + 400 * DAY_MS));
    render(publicPage(guestContent({ lateRsvp: { enabled: true } })));
    expect(rsvpText()).toContain("Send a late RSVP");
  });

  it("server HTML and hydration agree in the late window (no mismatch)", () => {
    for (const element of [
      invitePage(seed("EJ26-HARDWIN")),
      invitePage(seed("EJ26-BRILIAN"), guestContent(), "id"),
      publicPage(),
      travelPage(declinedBrilian()),
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
      expect(serverText).toMatch(/late RSVP|Update my RSVP|Perbarui RSVP saya/);
      act(() => hydrated?.unmount());
      host.remove();
    }
  });
});
