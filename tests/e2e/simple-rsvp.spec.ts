import crypto from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import { copy } from "@/lib/i18n";
import { NO_RSVP_DEADLINE } from "@/lib/rsvp";
import type { AdminSnapshot, PublicInviteType, WeddingContent } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";
import { E2E_ADMIN, E2E_BASE_URL, E2E_OPEN_RSVP_DEADLINE } from "./e2e-env";
import { expect, test } from "./fixtures";

// SF-7: the simple form at /JESSmarriED. Publishing a link changes what every
// page reads, so this runs in its own project after late-rsvp (one shared
// in-memory server) and restores what was published before.
const en = copy.en;
const SIMPLE_LINK: PublicInviteType = {
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
  const live = await publish({
    ...original,
    publicInviteTypes: [...original.publicInviteTypes, SIMPLE_LINK],
  });
  expect(
    live.publicInviteTypes.find((inviteType) => inviteType.code === SIMPLE_LINK.code),
  ).toMatchObject({ form: "simple", path: "JESSmarriED", rsvpDeadline: NO_RSVP_DEADLINE });
});

test.afterAll(async () => {
  const restored = await publish(original);
  expect(
    restored.publicInviteTypes.some((inviteType) => inviteType.code === SIMPLE_LINK.code),
  ).toBe(false);
  await admin.dispose();
});

test("/JESSmarriED: no schedule or calendar, and an RSVP without an email code", async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `simple-${suffix}@example.com`;
  const guestName = `Simple Guest ${suffix}`;

  // No event data in the page at all (not even in the hydration payload).
  const source = await (await page.request.get("/JESSmarriED")).text();
  expect(source).not.toContain("startTime");
  expect(source).not.toContain("/calendar.ics");

  await page.goto("/JESSmarriED");
  await page.getByRole("button", { name: en.openInvitation }).click();
  await expect(page.getByText(en.saveTheDate, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: en.scheduleTitle })).toHaveCount(0);
  for (const event of weddingContent.events) {
    await expect(page.getByRole("heading", { name: event.title.en })).toHaveCount(0);
    await expect(page.getByText(event.startTime)).toHaveCount(0);
  }
  await expect(page.locator('a[href="/calendar.ics"]')).toHaveCount(0);

  await page.getByRole("button", { name: en.registerRsvp }).click();
  await expect(page.getByRole("heading", { name: en.simpleFormTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: en.sendCode })).toHaveCount(0);
  await page.getByLabel(en.yourName).fill(guestName);
  await page.getByLabel(en.simpleWhatsApp).fill("8123123123");
  await page.getByLabel(en.emailAddress).fill(email);
  await page.getByRole("button", { name: en.simpleYes }).click();
  await page.getByLabel(en.simpleHowMany).selectOption("2");
  await page.getByLabel(en.simpleDietary).fill("Vegetarian");
  await page.getByRole("button", { name: en.saveRsvp }).click();

  await expect(page.getByRole("heading", { name: "Thank you, Simple!" })).toBeVisible();
  await expect(page.getByText("We've received your RSVP for 2 people.")).toBeVisible();
  await expect(page.getByRole("link", { name: en.openMap, exact: true })).toHaveAttribute(
    "href",
    weddingContent.venue.mapsUrl,
  );
  await expect(page.getByRole("link", { name: en.contactWhatsApp })).toBeVisible();
  await expect(page.locator('a[href="/calendar.ics"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: en.viewYourInvite })).toHaveCount(0);

  // Saved for the couple: the dinner only, meals unset, the note, no deadline.
  const exported = await admin.get("/api/admin/export?format=json");
  const snapshot = (await exported.json()) as AdminSnapshot;
  const saved = snapshot.invitations.find((invitation) => invitation.email === email);
  expect(saved).toMatchObject({
    groupName: guestName,
    flow: "generic",
    source: "generic",
    eligibleEvents: ["dinner"],
    rsvpDeadline: NO_RSVP_DEADLINE,
    rsvp: {
      status: "attending",
      eventAttendance: { dinner: true },
      message: "Dietary: Vegetarian",
    },
  });
  expect(saved!.guests.map((guest) => guest.mealPreference)).toEqual(["unset", "unset"]);
});

test("/jessmarried, /JESSMARRIED and /invite/JESSMARRIED keep the standard form", async ({
  page,
}) => {
  for (const path of ["/jessmarried", "/JESSMARRIED", "/invite/JESSMARRIED"]) {
    await page.goto(path);
    await page.getByRole("button", { name: en.openInvitation }).click();
    await expect(page.getByRole("heading", { name: en.scheduleTitle }), path).toBeVisible();
    for (const event of weddingContent.events) {
      await expect(page.getByRole("heading", { name: event.title.en })).toBeVisible();
    }
    await expect(page.locator('a[href="/calendar.ics"]')).toHaveCount(2);
    await page.getByRole("button", { name: en.registerRsvp }).click();
    await expect(page.getByRole("button", { name: en.sendCode }), path).toBeVisible();
    await expect(page.getByLabel(en.emailAddress)).toBeVisible();
    await expect(page.getByRole("heading", { name: en.simpleFormTitle })).toHaveCount(0);
  }
});

test("admin: the link card shows its form and custom address; the RSVP tab shows the note", async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const groupName = `Simple Admin ${suffix}`;
  const registered = await admin.post("/api/rsvp/simple", {
    data: {
      accessCode: SIMPLE_LINK.code,
      name: groupName,
      phone: "+62 8123123123",
      email: `simple-admin-${suffix}@example.com`,
      attending: true,
      guestCount: 1,
      dietary: "No nuts",
      website: "",
      language: "en",
    },
  });
  expect(await registered.json()).toMatchObject({ ok: true, existing: false });

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Content" }).click();
  const card = page.locator(".invite-panel").filter({ hasText: SIMPLE_LINK.label.en });
  await expect(
    card.locator("select").filter({ has: page.locator('option[value="simple"]') }),
  ).toHaveValue("simple");
  await expect(card.getByPlaceholder("e.g. JESSmarriED")).toHaveValue("JESSmarriED");
  await expect(
    card.getByText("rsvp.edwardjessica.com/JESSmarriED — opens this link (exact capitalisation only)."),
  ).toBeVisible();
  await expect(
    card.getByText(
      "Share as rsvp.edwardjessica.com/JESSmarriED (custom address, exact capitalisation). It also opens at /invite/JESSMARRIED-SIMPLE or /jessmarried-simple.",
      { exact: false },
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "RSVP", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: groupName });
  await expect(row.getByText("Note: Dietary: No nuts")).toBeVisible();
  // The Guests table is unchanged (no notes there).
  await page.getByRole("button", { name: "Guests", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: groupName }).getByText("Note:"),
  ).toHaveCount(0);
});
