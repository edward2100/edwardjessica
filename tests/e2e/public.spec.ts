import crypto from "node:crypto";
import { copy } from "@/lib/i18n";
import { weddingContent } from "@/lib/wedding-content";
import { expect, stubEmailOtp, test } from "./fixtures";

const en = copy.en;

// chromium and mobile share one in-memory server, so anything a test creates
// gets a per-run suffix.
function uniqueSuffix(projectName: string) {
  return `${projectName} ${crypto.randomUUID().slice(0, 8)}`;
}

test("public landing shows the general invitation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(/Edward\s*&\s*Jessica/i);
  await expect(page.getByText(en.genericInviteGreeting, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: en.openInvitation }).click();
  for (const event of weddingContent.events) {
    await expect(page.getByRole("heading", { name: event.title.en })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: en.registerRsvp })).toBeVisible();
});

test("personal invite link greets the guest", async ({ page }) => {
  await page.goto("/invite/EJ26-HARDWIN");
  await expect(page.locator("h1")).toHaveText(/Edward\s*&\s*Jessica/i);
  await expect(page.getByText("Dear Mr. Hardwin & Family", { exact: true })).toBeVisible();
});

test("admin preview login reaches dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("edward@example.com");
  await page.getByLabel("Password").fill("preview");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Wedding Admin")).toBeVisible();
});

test("admin can create, edit, and delete a guest group", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const groupName = `QA Browser Family ${suffix}`;
  const updatedName = `${groupName} Updated`;
  const groupRow = (name: string) => page.getByRole("row").filter({ hasText: name });

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("edward@example.com");
  await page.getByLabel("Password").fill("preview");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Guests" }).click();
  const templateLink = page.getByRole("link", { name: "CSV Template" });
  await expect(templateLink).toHaveAttribute("href", "/api/admin/guests?format=template");
  await page.getByRole("button", { name: "New Group" }).click();
  await page.getByLabel("Group name").fill(groupName);
  await page.getByLabel("Greeting").fill(`Dear ${groupName}`);
  await page.getByLabel("Phone / WhatsApp").fill("+628555000");
  await page.getByLabel("Email").fill(`qa-browser-${suffix.replace(/\W+/g, "-")}@example.com`);
  await page.getByLabel("Side").selectOption("bride");
  await page.getByLabel("Guest 1 name").fill("QA Browser Guest");
  await page.getByLabel("Guest 1 meal preference").selectOption("vegetarian");
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByText("Guest group saved.")).toBeVisible();
  await expect(groupRow(groupName)).toBeVisible();

  await groupRow(groupName).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Group name").fill(updatedName);
  await page.getByRole("button", { name: "Add Guest" }).click();
  await page.getByLabel("Guest 2 name").fill("QA Browser Second Guest");
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByText("Guest group saved.")).toBeVisible();
  await expect(groupRow(updatedName)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Group" }).click();
  await expect(page.getByText("Guest group deleted.")).toBeVisible();
  await expect(groupRow(updatedName)).toHaveCount(0);
});

test("generic invite link self-registers after email verification", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const email = `self-register-${suffix.replace(/\W+/g, "-")}@example.com`;
  const guestName = `Self Register ${suffix}`;
  const plusOneName = "Self Register Plus One";
  const otpCode = "123456";
  await stubEmailOtp(page, { email, code: otpCode });

  // Mixed case on purpose: link codes are case-insensitive.
  await page.goto("/invite/JESSmarriED");
  await expect(page.locator("h1")).toHaveText(/Edward\s*&\s*Jessica/i);
  await page.getByRole("button", { name: en.openInvitation }).click();
  for (const event of weddingContent.events) {
    await expect(page.getByRole("heading", { name: event.title.en })).toBeVisible();
  }

  await page.getByRole("button", { name: en.registerRsvp }).click();
  await page.getByLabel(en.emailAddress).fill(email);
  await page.getByRole("button", { name: en.sendCode }).click();
  await page.getByLabel(en.enterOtpCode).fill(otpCode);
  await page.getByRole("button", { name: en.verifyCode }).click();

  await page.getByLabel(en.yourName).fill(guestName);
  // The phone input has no associated label (country code select + number).
  await page.locator("#self-phone").fill("8123123123");
  await page.getByLabel(en.guestCount).fill("2");
  await page.getByLabel(en.plusOneName).fill(plusOneName);
  await page.getByLabel(en.mealChoice).selectOption("vegetarian");
  for (const event of weddingContent.events) {
    await expect(page.getByRole("checkbox", { name: event.shortTitle.en })).toBeChecked();
  }
  await page.getByRole("button", { name: en.saveRsvp }).click();

  await expect(page.getByRole("heading", { name: en.successAttendingHeading })).toBeVisible();
  await expect(page.getByText(`${guestName}, ${plusOneName}`)).toBeVisible();
  await page.getByRole("button", { name: en.viewYourInvite }).click();
  await expect(page).toHaveURL(/\/invite\/SELFREGISTER[A-Z0-9]+$/);
  await expect(page.getByText(`Dear ${guestName}`, { exact: true })).toBeVisible();
  for (const event of weddingContent.events) {
    await expect(page.getByRole("heading", { name: event.title.en })).toBeVisible();
  }
});
