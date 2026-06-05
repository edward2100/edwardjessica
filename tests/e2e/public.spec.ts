import { expect, test } from "@playwright/test";

test("public landing loads and opens personalized invite", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(/Edward\s*\+\s*Jessica/i);
  await page.getByLabel(/Enter invitation code/i).fill("EJ26-HARDWIN");
  await page.getByRole("button", { name: /Open Invitation/i }).click();
  await expect(page).toHaveURL(/\/invite\/EJ26-HARDWIN/);
  await expect(page.getByText("Dear Mr. Hardwin & Family")).toBeVisible();
});

test("admin preview login reaches dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill("preview");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Wedding Admin")).toBeVisible();
});

test("admin can create, edit, and delete a guest group", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill("preview");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Guests" }).click();
  const templateLink = page.getByRole("link", { name: "CSV Template" });
  await expect(templateLink).toHaveAttribute("href", "/api/admin/guests?format=template");
  await page.getByRole("button", { name: "New Group" }).click();
  await page.getByLabel("Group name").fill("QA Browser Family");
  await page.getByLabel("Greeting").fill("Dear QA Browser Family");
  await page.getByLabel("Phone / WhatsApp").fill("+628555000");
  await page.getByLabel("Email").fill("qa-browser@example.com");
  await page.getByLabel("Side").selectOption("bride");
  await page.getByLabel("Guest 1 name").fill("QA Browser Guest");
  await page.getByLabel("Guest 1 meal preference").selectOption("vegetarian");
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByText("Guest group saved.")).toBeVisible();
  await expect(page.getByRole("row", { name: /QA Browser Family/ })).toBeVisible();

  await page.getByRole("row", { name: /QA Browser Family/ }).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Group name").fill("QA Browser Family Updated");
  await page.getByRole("button", { name: "Add Guest" }).click();
  await page.getByLabel("Guest 2 name").fill("QA Browser Second Guest");
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByText("Guest group saved.")).toBeVisible();
  await expect(page.getByRole("row", { name: /QA Browser Family Updated/ })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Group" }).click();
  await expect(page.getByText("Guest group deleted.")).toBeVisible();
  await expect(page.getByRole("row", { name: /QA Browser Family Updated/ })).toHaveCount(0);
});

test("generic invite code self-registers immediately", async ({ page }) => {
  await page.goto("/invite/JESSmarriED");
  await expect(page.getByRole("heading", { name: /Edward\s*\+\s*Jessica/i })).toBeVisible();
  await expect(page.getByText("Buddhist Holy Matrimony")).toBeVisible();
  await expect(page.getByText("Chinese Tea Ceremony & Lunch")).toBeVisible();
  await expect(page.getByText("Dinner Reception")).toBeVisible();
  await page.getByRole("button", { name: "Register RSVP" }).click();
  await page.getByLabel("Name").fill("Self Register Guest");
  await page.getByLabel("Phone / WhatsApp").fill("+628123123123");
  await page.getByLabel("Guest count").fill("2");
  await page.getByLabel("Meal choice").selectOption("vegetarian");
  await expect(page.getByText("Holy Matrimony", { exact: true })).toBeVisible();
  await expect(page.getByText("Tea & Lunch", { exact: true })).toBeVisible();
  await expect(page.getByText("Dinner", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save RSVP" }).click();
  await expect(page.getByText("RSVP saved")).toBeVisible();
  await expect(page.getByText(/Your personal invitation code is SELFREGISTERGUEST\d*/)).toBeVisible();
  await page.getByRole("link", { name: "View your invite" }).click();
  await expect(page.getByText("Buddhist Holy Matrimony")).toBeVisible();
  await expect(page.getByText("Chinese Tea Ceremony & Lunch")).toBeVisible();
  await expect(page.getByText("Dinner Reception")).toBeVisible();
});
