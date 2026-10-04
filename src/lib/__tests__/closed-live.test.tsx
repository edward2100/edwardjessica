import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { toGuestContent, toGuestInvitation } from "@/lib/rsvp";
import { sampleInvitations } from "@/lib/seed";
import type { PublicInviteType } from "@/lib/types";
import { useRsvpClosed } from "@/lib/use-rsvp-closed";
import { weddingContent } from "@/lib/wedding-content";

// CL-5: a page left open across the deadline switches to the closed state
// without a reload (client clock), like a 403 from the server.
const DEADLINE = "2026-11-03T16:59:59.000Z";
const DEADLINE_MS = new Date(DEADLINE).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_WHATSAPP = "https://wa.me/message/COSKSKIJH7AHP1";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let container: HTMLDivElement;
let root: Root;

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

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("localStorage", memoryStorage());
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

function render(element: ReactElement) {
  act(() => root.render(element));
}

function rsvpText() {
  return container.querySelector("#rsvp")?.textContent ?? "";
}

function Probe({ deadline }: { deadline: string }) {
  return <span>{useRsvpClosed(deadline) ? "closed" : "open"}</span>;
}

describe("useRsvpClosed (CL-5)", () => {
  it("flips to closed just after the deadline passes", () => {
    vi.setSystemTime(DEADLINE_MS - 1000);
    render(<Probe deadline={DEADLINE} />);
    expect(container.textContent).toBe("open");
    act(() => vi.advanceTimersByTime(1000));
    // The deadline instant itself is still open (strict >).
    expect(container.textContent).toBe("open");
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).toBe("closed");
  });

  it("waits in steps for deadlines further away than the timer limit", () => {
    vi.setSystemTime(DEADLINE_MS - 30 * DAY_MS);
    render(<Probe deadline={DEADLINE} />);
    // A single setTimeout this long would fire at once.
    act(() => vi.advanceTimersByTime(1000));
    expect(container.textContent).toBe("open");
    act(() => vi.advanceTimersByTime(25 * DAY_MS));
    expect(container.textContent).toBe("open");
    act(() => vi.advanceTimersByTime(4 * DAY_MS));
    expect(container.textContent).toBe("open");
    act(() => vi.advanceTimersByTime(DAY_MS));
    expect(container.textContent).toBe("closed");
  });

  it("re-checks when the tab regains focus (device clock jumped past the deadline)", () => {
    vi.setSystemTime(DEADLINE_MS - 1000);
    render(<Probe deadline={DEADLINE} />);
    // Wall clock moves on without the timer firing (e.g. the device slept).
    vi.setSystemTime(DEADLINE_MS + 60_000);
    expect(container.textContent).toBe("open");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(container.textContent).toBe("closed");
  });

  it("is closed straight away after the deadline and ignores invalid dates", () => {
    vi.setSystemTime(DEADLINE_MS + 1);
    render(<Probe deadline={DEADLINE} />);
    expect(container.textContent).toBe("closed");
    render(<Probe deadline="not a date" />);
    expect(container.textContent).toBe("open");
    expect(vi.getTimerCount()).toBe(0);
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

const overseasFamilyFriends: PublicInviteType = {
  id: "custom-overseas-family-friends",
  label: { en: "Overseas family & friends", id: "Keluarga & sahabat luar negeri" },
  code: "OVERSEAS-FAMILY-FRIENDS",
  flow: "overseas",
  maxGuests: 1,
  requireGuestNames: false,
  isEnabled: true,
  rsvpDeadline: DEADLINE,
};

const content = toGuestContent(
  { ...weddingContent, rsvpContact: { whatsappUrl: OWNER_WHATSAPP } },
  DEADLINE,
);

describe("pages left open across the deadline (CL-5/CL-6/CL-8)", () => {
  it("personal invite: open card switches to the closed card with contact links", () => {
    vi.setSystemTime(DEADLINE_MS - 90_000);
    const brilian = toGuestInvitation(
      sampleInvitations.find((invitation) => invitation.code === "EJ26-BRILIAN")!,
    );
    render(<InvitePage content={content} invitation={brilian} />);
    expect(rsvpText()).toContain("Update RSVP");
    expect(rsvpText()).toContain("RSVP closes soon — 1 day left");
    expect(rsvpText()).not.toContain("RSVP is now closed");

    act(() => vi.advanceTimersByTime(90_001));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("confirmed as attending");
    expect(rsvpText()).toContain("Submit your travel plans →");
    expect(rsvpText()).toContain("Message us on WhatsApp");
    expect(rsvpText()).not.toContain("Update RSVP");
    expect(rsvpText()).not.toContain("day left");
  });

  it("public link: registration card switches to the closed card with lookup", () => {
    vi.setSystemTime(DEADLINE_MS - 90_000);
    render(
      <AppRouterContext.Provider value={stubRouter}>
        <SelfRegisterInvitePage content={content} inviteType={overseasFamilyFriends} />
      </AppRouterContext.Provider>,
    );
    expect(rsvpText()).toContain("Ready to confirm?");
    expect(rsvpText()).toContain("RSVP closes soon — 1 day left");

    act(() => vi.advanceTimersByTime(90_001));
    expect(rsvpText()).toContain("RSVP is now closed");
    expect(rsvpText()).toContain("Already registered? Open my invitation");
    expect(rsvpText()).toContain("Message us on WhatsApp");
    expect(rsvpText()).not.toContain("Ready to confirm?");
    expect(rsvpText()).not.toContain("day left");
    expect(container.querySelector("#self-name")).toBeNull();
  });
});
