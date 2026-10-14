import { expect, test } from "@playwright/test";

// AE-1: the RSVP tab's "Email confirmation" action, end to end against the
// demo server (no Resend key there, so the send stops at the email service).
test("admin can email an RSVP confirmation from the RSVP tab", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("edward@example.com");
  await page.getByLabel("Password").fill("preview");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "RSVP", exact: true }).click();

  // A group that never replied has nothing to confirm yet.
  const pendingRow = page.getByRole("row").filter({ hasText: "EJ26-HARDWIN" });
  await expect(
    pendingRow.getByRole("button", { name: /Email RSVP confirmation/ }),
  ).toBeDisabled();

  const row = page.getByRole("row").filter({ hasText: "EJ26-BRILIAN" });
  await row.getByRole("button", { name: /Email RSVP confirmation/ }).click();
  const address = row.getByLabel("Send the RSVP confirmation to");
  await expect(address).toBeVisible();
  // Nothing is sent until the address is valid and Send is pressed.
  const sendButton = row.getByRole("button", { name: "Send email" });
  await address.fill("not-an-email");
  await expect(sendButton).toBeDisabled();
  await address.fill("qa.confirmation@example.com");
  await sendButton.click();
  await expect(
    row.getByText("The email service isn't set up, so nothing was sent."),
  ).toBeVisible();
});
