import crypto from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import { copy } from "@/lib/i18n";
import type { AdminSnapshot, WeddingContent } from "@/lib/types";
import { E2E_ADMIN, E2E_BASE_URL, E2E_OPEN_RSVP_DEADLINE } from "./e2e-env";
import { expect, stubEmailOtp, test } from "./fixtures";

// LR-5: late RSVPs on /jessmarried. These publish a deadline in the past, so
// they run in their own project after chromium + mobile (one shared
// in-memory server) and restore what the setup project published.
const en = copy.en;
const PAST_DEADLINE = "2020-01-01T16:59:59.000Z"; // 1 January 2020 (WIB)
const LATE_UNTIL = "2099-12-31T16:59:59.000Z"; // 31 December 2099 (WIB)

let admin: APIRequestContext;
let original: WeddingContent;

async function publish(content: WeddingContent) {
  const saved = await admin.put("/api/admin/content", { data: content });
  expect(saved.ok()).toBe(true);
  const published = await admin.post("/api/admin/content", {
    data: { action: "publish" },
  });
  expect(published.ok()).toBe(true);
  return ((await published.json()) as { content: WeddingContent }).content;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await request.newContext({ baseURL: E2E_BASE_URL });
  expect((await admin.post("/api/admin/login", { data: E2E_ADMIN })).ok()).toBe(true);
  const draft = await admin.get("/api/admin/content");
  original = ((await draft.json()) as { content: WeddingContent }).content;
  expect(original.rsvpDeadline).toBe(E2E_OPEN_RSVP_DEADLINE);
});

test.afterAll(async () => {
  const restored = await publish(original);
  expect(restored.rsvpDeadline).toBe(E2E_OPEN_RSVP_DEADLINE);
  await admin.dispose();
});

test("after the deadline, a guest self-registers late on /jessmarried", async ({
  page,
}, testInfo) => {
  const live = await publish({
    ...original,
    rsvpDeadline: PAST_DEADLINE,
    lateRsvp: { enabled: true, until: LATE_UNTIL },
  });
  expect(live.lateRsvp).toEqual({ enabled: true, until: LATE_UNTIL });
  const suffix = `${testInfo.project.name} ${crypto.randomUUID().slice(0, 8)}`;
  const email = `late-${suffix.replace(/\W+/g, "-")}@example.com`;
  const guestName = `Late Guest ${suffix}`;
  const otpCode = "123456";
  await stubEmailOtp(page, { email, code: otpCode });

  await page.goto("/jessmarried");
  await page.getByRole("button", { name: en.openInvitation }).click();
  const rsvp = page.locator("#rsvp");
  await expect(rsvp.getByRole("heading", { name: en.rsvpClosed })).toBeVisible();
  await expect(
    rsvp.getByText(
      "Missed the date? You can still send a late RSVP until 31 December 2099, or get in touch with us:",
    ),
  ).toBeVisible();
  const lateButton = rsvp.getByRole("button", { name: en.sendLateRsvp });
  await expect(lateButton).toHaveClass(/button-brown/);
  await expect(rsvp.getByRole("link", { name: en.contactWhatsApp })).toBeVisible();
  await expect(
    rsvp.getByRole("button", { name: en.alreadyRegisteredOpen }),
  ).toBeVisible();
  await expect(rsvp.getByRole("button", { name: en.registerRsvp })).toHaveCount(0);
  await expect(page.locator(".floating-rsvp-button")).toBeVisible();

  await lateButton.click();
  await expect(
    rsvp.getByText(
      "Late RSVP · Our RSVP date was 1 January 2020. We'll confirm your place with you.",
    ),
  ).toBeVisible();
  await page.getByLabel(en.emailAddress).fill(email);
  await page.getByRole("button", { name: en.sendCode }).click();
  await page.getByLabel(en.enterOtpCode).fill(otpCode);
  await page.getByRole("button", { name: en.verifyCode }).click();

  await page.getByLabel(en.yourName).fill(guestName);
  await page.locator("#self-phone").fill("8123123123");
  await page.getByLabel(en.mealChoice).selectOption("vegetarian");
  await page.getByRole("button", { name: en.saveRsvp }).click();

  // "Received", not "confirmed": the couple confirms a late place.
  await expect(
    page.getByRole("heading", { name: en.successLateHeading }),
  ).toBeVisible();
  await expect(page.getByText(en.lateRsvpReceived)).toBeVisible();
  await expect(page.getByText(en.successAttendingHeading)).toHaveCount(0);

  // Saved like any RSVP and marked late for the couple.
  const exported = await admin.get("/api/admin/export?format=json");
  const snapshot = (await exported.json()) as AdminSnapshot;
  const registered = snapshot.invitations.find(
    (invitation) => invitation.groupName === guestName,
  );
  expect(registered?.rsvp.status).toBe("attending");
  expect(snapshot.lateResponses[registered!.id]).toMatchObject({ kind: "late" });
});

test("late RSVPs switched off: the closed card, with no late RSVP button", async ({
  page,
}) => {
  const live = await publish({
    ...original,
    rsvpDeadline: PAST_DEADLINE,
    lateRsvp: { enabled: false },
  });
  expect(live.lateRsvp).toEqual({ enabled: false });

  await page.goto("/jessmarried");
  await page.getByRole("button", { name: en.openInvitation }).click();
  const rsvp = page.locator("#rsvp");
  await expect(rsvp.getByRole("heading", { name: en.rsvpClosed })).toBeVisible();
  await expect(rsvp.getByText(en.closedReachOutPending)).toBeVisible();
  await expect(rsvp.getByRole("link", { name: en.contactWhatsApp })).toBeVisible();
  await expect(
    rsvp.getByRole("button", { name: en.alreadyRegisteredOpen }),
  ).toBeVisible();
  await expect(rsvp.getByRole("button", { name: en.sendLateRsvp })).toHaveCount(0);
  await expect(rsvp.getByText(/late RSVP/i)).toHaveCount(0);
  await expect(page.locator(".floating-rsvp-button")).toHaveCount(0);
});
