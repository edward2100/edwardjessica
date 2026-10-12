import { expect, test as setup } from "@playwright/test";
import type { PublicInviteType, WeddingContent } from "@/lib/types";
import { E2E_ADMIN, E2E_OPEN_RSVP_DEADLINE } from "./e2e-env";

// Runs once against the fresh in-memory demo server before the browser
// projects, so guest tests never depend on today's date versus RSVP_DEADLINE.
setup("publish an open RSVP deadline via the demo admin API", async ({ request }) => {
  const login = await request.post("/api/admin/login", { data: E2E_ADMIN });
  expect(login.ok()).toBe(true);

  const draft = await request.get("/api/admin/content");
  expect(draft.ok()).toBe(true);
  const { content } = (await draft.json()) as { content: WeddingContent };

  const saved = await request.put("/api/admin/content", {
    data: {
      ...content,
      rsvpDeadline: E2E_OPEN_RSVP_DEADLINE,
      // Every public link falls back to the main deadline.
      publicInviteTypes: content.publicInviteTypes.map(
        (inviteType): PublicInviteType => ({
          ...inviteType,
          rsvpDeadline: undefined,
        }),
      ),
    },
  });
  expect(saved.ok()).toBe(true);

  const published = await request.post("/api/admin/content", {
    data: { action: "publish" },
  });
  expect(published.ok()).toBe(true);
  const { content: live } = (await published.json()) as {
    content: WeddingContent;
  };
  expect(live.rsvpDeadline).toBe(E2E_OPEN_RSVP_DEADLINE);
  expect(live.publicInviteTypes.every((item) => !item.rsvpDeadline)).toBe(true);
});
