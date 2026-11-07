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

test("/JESSmarriED: the full page with The Day's Events, and an RSVP without an email code", async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `simple-${suffix}@example.com`;
  const guestName = `Simple Guest ${suffix}`;

  // Same page as the standard link: The Day's Events with times and both
  // calendar buttons. Only the RSVP form leaves out the event choices.
  await page.goto("/JESSmarriED");
  await page.getByRole("button", { name: en.openInvitation }).click();
  await expect(page.getByText(en.saveTheDate, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: en.scheduleTitle })).toBeVisible();
  for (const event of weddingContent.events) {
    await expect(page.getByRole("heading", { name: event.title.en })).toBeVisible();
  }
  await expect(page.locator('a[href="/calendar.ics"]')).toHaveCount(2);

  await page.getByRole("button", { name: en.registerRsvp }).click();
  await expect(page.getByRole("heading", { name: en.simpleFormTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: en.sendCode })).toHaveCount(0);
  await page.getByLabel(en.yourName).fill(guestName);
  await page.getByLabel(en.simpleWhatsApp).fill("8123123123");
  await page.getByLabel(en.emailAddress).fill(email);
  await page.getByRole("button", { name: en.simpleYes }).click();
  await page.getByLabel(en.simpleHowMany).selectOption("2");
  // PL-4: the second person is named too.
  await page.getByLabel("Guest 2 name").fill(`Plus One ${suffix}`);
  // DT-1: a Vegetarian / Non-vegetarian dropdown per person, named as typed.
  await expect(page.getByText(en.simpleDietary, { exact: true })).toBeVisible();
  await expect(page.locator("label[for='simple-meal-2'] > span")).toHaveText(`Plus One ${suffix}`);
  await page.locator("#simple-meal-1").selectOption("vegetarian");
  await page.getByRole("button", { name: en.saveRsvp }).click();

  await expect(page.getByRole("heading", { name: "Thank you, Simple!" })).toBeVisible();
  await expect(page.getByText("We've received your RSVP for 2 people.")).toBeVisible();
  await expect(page.getByRole("link", { name: en.openMap, exact: true })).toHaveAttribute(
    "href",
    weddingContent.venue.mapsUrl,
  );
  await expect(page.getByRole("link", { name: en.contactWhatsApp })).toBeVisible();
  // The success screen itself offers no calendar file or invite link.
  await expect(page.locator('#rsvp a[href="/calendar.ics"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: en.viewYourInvite })).toHaveCount(0);

  // Saved for the couple: the dinner only, each meal, the note, no deadline.
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
      message: "Dietary: 1 vegetarian",
    },
  });
  expect(saved!.guests.map((guest) => [guest.name, guest.mealPreference])).toEqual([
    [guestName, "vegetarian"],
    [`Plus One ${suffix}`, "non_vegetarian"],
  ]);
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

// PL-7: a personal link made by a CSV import with a link column (PL-8: the
// server picks a random code). Runs last: it switches the opening to the
// moon gate cover, then restores the content.
test("a personal link: the guest's name on the cover and hero, a prefilled RSVP that can be changed", async ({
  page,
}) => {
  const id = copy.id;
  const csv = [
    "groupName,greeting,name,maxGuests,side,flow,events,link,note",
    "Bp. Hadi & Istri,Dear Bp. Hadi & Istri,Bp. Hadi,2,groom,generic,dinner,JESSmarriED,Dietary: 1 vegetarian",
    "Bp. Hadi & Istri,Dear Bp. Hadi & Istri,Istri,2,groom,generic,dinner,JESSmarriED,",
  ].join("\n");
  const imported = await admin.post("/api/admin/guests", { data: { csv } });
  expect(imported.ok()).toBe(true);
  const { created } = (await imported.json()) as { created: Array<{ code: string }> };
  expect(created).toHaveLength(1);
  const code = created[0].code;
  expect(code).toMatch(/^JESSMARRIED-[2-9A-HJKMNP-Z]{12}$/);
  const personalSuffix = code.slice("JESSMARRIED-".length);
  const draft = (await (await admin.get("/api/admin/content")).json()) as {
    content: WeddingContent;
  };
  await publish({ ...draft.content, openingAnimation: "moongate" });

  try {
    // Reduced motion stops the monogram's pulse, so it can be clicked.
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Opens in Indonesian with the name on the cover.
    await page.goto(`/JESSmarriED-${personalSuffix}`);
    const cover = page.locator(".opening-cover");
    await expect(cover.getByText(id.coverGreeting, { exact: true })).toBeVisible();
    await expect(cover.getByText("Bp. Hadi & Istri", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: id.tapToOpen }).click();
    await expect(cover).toHaveCount(0);
    await expect(page.locator(".hero-guest-name")).toHaveText("Bp. Hadi & Istri");

    await page.getByRole("button", { name: id.registerRsvp }).click();
    await expect(page.getByLabel(id.yourName)).toHaveCount(0);
    await expect(page.getByLabel(id.simpleWhatsApp)).toHaveCount(0);
    await page.getByRole("button", { name: id.simpleYes }).click();
    await expect(page.getByLabel(id.personalGuestCount)).toHaveValue("2");
    await expect(page.getByLabel("Nama tamu 1")).toHaveValue("Bp. Hadi");
    await expect(page.getByLabel("Nama tamu 2")).toHaveValue("Istri");
    // DT-1: the sheet's "1 vegetarian" starts the first dropdown on Vegetarian.
    await expect(page.locator("label[for='simple-meal-1'] > span")).toHaveText("Bp. Hadi");
    await expect(page.locator("#simple-meal-1")).toHaveValue("vegetarian");
    await expect(page.locator("#simple-meal-2")).toHaveValue("non_vegetarian");
    await page.getByLabel("Nama tamu 2").fill("Ibu Wati");
    await page.getByRole("button", { name: id.saveRsvp }).click();
    await expect(
      page.getByRole("heading", { name: "Terima kasih, Bp. Hadi & Istri!" }),
    ).toBeVisible();
    await expect(page.getByText(id.personalChangeHere)).toBeVisible();

    const exported = await admin.get("/api/admin/export?format=json");
    const saved = ((await exported.json()) as AdminSnapshot).invitations.find(
      (invitation) => invitation.code === code,
    );
    expect(saved).toMatchObject({
      groupName: "Bp. Hadi & Istri",
      source: "admin",
      eligibleEvents: ["dinner"],
      rsvpDeadline: NO_RSVP_DEADLINE,
      rsvp: {
        status: "attending",
        eventAttendance: { dinner: true },
        message: "Dietary: 1 vegetarian",
      },
    });
    expect(saved!.guests.map((guest) => [guest.name, guest.mealPreference])).toEqual([
      ["Bp. Hadi", "vegetarian"],
      ["Ibu Wati", "non_vegetarian"],
    ]);

    // A refresh shows the cover again, then the saved answer.
    await page.reload();
    await expect(cover.getByText("Bp. Hadi & Istri", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: id.tapToOpen }).click();
    await expect(page.getByText("Hadir · 2 orang: Bp. Hadi, Ibu Wati")).toBeVisible();
    await expect(page.getByRole("button", { name: id.personalChange })).toBeVisible();

    // The invitation's /invite/<code> address leads to the personal link.
    await page.goto(`/invite/${code}`);
    await expect(page).toHaveURL(new RegExp(`/JESSmarriED-${personalSuffix}$`));
  } finally {
    await publish(draft.content);
    await admin.delete("/api/admin/guests", { data: { code } });
  }
});
