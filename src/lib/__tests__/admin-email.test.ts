import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitationGroup } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

// AE-1: admin "Email confirmation" (route + recipient override).
const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  getInvitationByCode: vi.fn(),
  getPublishedContent: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/data-store", () => ({
  getInvitationByCode: mocks.getInvitationByCode,
  getPublishedContent: mocks.getPublishedContent,
}));

import { POST } from "@/app/api/admin/rsvp/email/route";
import { sendRsvpConfirmationEmail } from "@/lib/rsvp-confirmation-email";

function invitation(overrides: Partial<InvitationGroup> = {}): InvitationGroup {
  return {
    id: "invite-ae",
    code: "EJ26-AE",
    greeting: "Dear Ana",
    groupName: "Ana Family",
    maxGuests: 2,
    side: "joint",
    flow: "generic",
    eligibleEvents: ["dinner"],
    email: "group@example.com",
    rsvp: {
      id: "rsvp-ae",
      invitationGroupId: "invite-ae",
      status: "attending",
      eventAttendance: { dinner: true },
      submittedAt: "2026-10-13T03:00:00.000Z",
    },
    guests: [
      { id: "g1", invitationGroupId: "invite-ae", name: "Ana", mealPreference: "vegetarian" },
    ],
    ...overrides,
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/rsvp/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  mocks.getCurrentAdmin.mockResolvedValue({ email: "edward@example.com" });
  mocks.getInvitationByCode.mockResolvedValue(invitation());
  mocks.getPublishedContent.mockResolvedValue(weddingContent);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function sentTo() {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)).to as string;
}

describe("sendRsvpConfirmationEmail recipient (AE-1)", () => {
  it("sends to the given address instead of the group's email", async () => {
    const result = await sendRsvpConfirmationEmail({
      content: weddingContent,
      invitation: invitation(),
      to: "typed@example.com",
    });
    expect(result).toEqual({ status: "sent" });
    expect(sentTo()).toBe("typed@example.com");
  });

  it("defaults to the group's email, and skips when there is no address at all", async () => {
    await sendRsvpConfirmationEmail({ content: weddingContent, invitation: invitation() });
    expect(sentTo()).toBe("group@example.com");
    const skipped = await sendRsvpConfirmationEmail({
      content: weddingContent,
      invitation: invitation({ email: undefined }),
    });
    expect(skipped.status).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/admin/rsvp/email (AE-1)", () => {
  it("is admin-only", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await post({ code: "EJ26-AE" });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emails the group's address by default, or the typed one", async () => {
    let response = await post({ code: "ej26-ae" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "sent", to: "group@example.com" });
    expect(mocks.getInvitationByCode).toHaveBeenCalledWith("EJ26-AE");

    fetchMock.mockClear();
    response = await post({ code: "EJ26-AE", email: "  other@example.com " });
    expect(await response.json()).toEqual({ status: "sent", to: "other@example.com" });
    expect(sentTo()).toBe("other@example.com");
  });

  it("refuses a pending RSVP, an unknown code and a bad address without sending", async () => {
    mocks.getInvitationByCode.mockResolvedValueOnce(
      invitation({
        rsvp: { ...invitation().rsvp, status: "pending", submittedAt: undefined },
      }),
    );
    expect((await post({ code: "EJ26-AE" })).status).toBe(400);

    mocks.getInvitationByCode.mockResolvedValueOnce(null);
    expect((await post({ code: "EJ26-NOPE" })).status).toBe(404);

    for (const email of ["not-an-email", "a@b.com?bcc=x@y.com", "a@b.com\nBcc: x@y.com"]) {
      const response = await post({ code: "EJ26-AE", email });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Enter a valid email address.");
    }

    mocks.getInvitationByCode.mockResolvedValueOnce(invitation({ email: undefined }));
    expect((await post({ code: "EJ26-AE" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says plainly when the email service is not set up or rejects the message", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    let response = await post({ code: "EJ26-AE" });
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe(
      "The email service isn't set up, so nothing was sent.",
    );

    vi.stubEnv("RESEND_API_KEY", "test-key");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      text: async () => "rejected",
    } as unknown as Response);
    response = await post({ code: "EJ26-AE" });
    expect(response.status).toBe(502);
    expect((await response.json()).status).toBe("failed");
  });

  it("never adds the late 'we'll confirm your place' sentence to an admin send", async () => {
    await post({ code: "EJ26-AE" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).html).not.toContain("after our RSVP date");
  });
});
