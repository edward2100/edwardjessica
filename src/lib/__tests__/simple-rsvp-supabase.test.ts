import { afterEach, describe, expect, it, vi } from "vitest";
import { createSimpleRegisteredInvitation } from "@/lib/data-store";
import { NO_RSVP_DEADLINE } from "@/lib/rsvp";
import type { PublicInviteType, SimpleRsvpSubmission } from "@/lib/types";

// SF-7: the Supabase branch of a simple registration, against a fake client:
// the rows it writes, and a unique-index race (another request saved the same
// email first) reported as `existing` with nothing else written.
type Op = [string, unknown[]];

const fake = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; rows: unknown }>,
  emailTaken: false,
}));

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServiceClient: () => ({ from: fakeQuery }),
  createSupabaseAuthClient: () => null,
  createSupabaseCookieClient: async () => null,
}));

const SIMPLE: PublicInviteType = {
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

const submission: SimpleRsvpSubmission = {
  accessCode: "JESSMARRIED-SIMPLE",
  name: "Ana Tan",
  phone: "+62 8123123123",
  email: "Ana@Example.com",
  attending: true,
  guestCount: 2,
  dietary: "Vegetarian",
  language: "en",
};

const existingRow = {
  id: "existing-group",
  code: "ANATAN",
  greeting: "Dear Ana Tan",
  group_name: "Ana Tan",
  email: "ana@example.com",
  max_guests: 2,
  side: "joint",
  source: "generic",
  flow: "generic",
  eligible_events: ["dinner"],
  rsvps: [{ id: "existing-rsvp", status: "attending", event_attendance: { dinner: true } }],
  guests: [{ id: "existing-guest", name: "Ana Tan", meal_preference: "unset" }],
};

function resolveQuery(table: string, ops: Op[], rows: unknown) {
  if (table === "invitation_groups") {
    if (rows) {
      return fake.emailTaken
        ? {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "invitation_groups_email_flow_self_idx"',
            },
          }
        : { data: { id: "new-group" }, error: null };
    }
    if (ops.some(([op]) => op === "ilike")) return { data: [existingRow], error: null };
    return { data: [], error: null };
  }
  if (table === "rsvps") return { data: { id: "new-rsvp" }, error: null };
  if (table === "guests") {
    return {
      data: (rows as Array<{ name: string; meal_preference: string }>).map(
        (row, index) => ({ id: `new-guest-${index + 1}`, ...row }),
      ),
      error: null,
    };
  }
  return { data: null, error: null };
}

function fakeQuery(table: string) {
  const ops: Op[] = [];
  let rows: unknown;
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order", "limit", "in", "is", "ilike"]) {
    builder[name] = (...args: unknown[]) => {
      ops.push([name, args]);
      return builder;
    };
  }
  builder.insert = (value: unknown) => {
    rows = value;
    fake.writes.push({ table, rows: value });
    return builder;
  };
  builder.single = async () => resolveQuery(table, ops, rows);
  builder.maybeSingle = async () => resolveQuery(table, ops, rows);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected: (reason: unknown) => unknown,
  ) => Promise.resolve(resolveQuery(table, ops, rows)).then(onFulfilled, onRejected);
  return builder;
}

afterEach(() => {
  fake.writes.length = 0;
  fake.emailTaken = false;
  vi.restoreAllMocks();
});

describe("simple registration on Supabase (SF-4)", () => {
  it("writes a dinner-only group with the link deadline, unset meals, the dietary note and a history row", async () => {
    const { invitation, existing } = await createSimpleRegisteredInvitation(
      submission,
      SIMPLE,
    );
    expect(existing).toBe(false);
    expect(fake.writes.map((write) => write.table)).toEqual([
      "invitation_groups",
      "rsvps",
      "guests",
      "rsvp_history",
    ]);
    expect(fake.writes[0].rows).toMatchObject({
      code: "ANATAN",
      group_name: "Ana Tan",
      email: "Ana@Example.com",
      phone: "+62 8123123123",
      max_guests: 2,
      source: "generic",
      flow: "generic",
      eligible_events: ["dinner"],
      rsvp_deadline: NO_RSVP_DEADLINE,
      private_notes: {
        en: "Registered through the simple form (/JESSmarriED).",
        inviteFlow: "generic",
      },
    });
    expect(fake.writes[1].rows).toMatchObject({
      invitation_group_id: "new-group",
      status: "attending",
      event_attendance: { dinner: true },
      message: "Dietary: Vegetarian",
      updated_by: "guest",
    });
    expect(fake.writes[2].rows).toEqual([
      { invitation_group_id: "new-group", name: "Ana Tan", meal_preference: "unset" },
      { invitation_group_id: "new-group", name: "Ana Tan Guest 2", meal_preference: "unset" },
    ]);
    expect(fake.writes[3].rows).toMatchObject({ changed_by: "guest", status: "attending" });
    expect(invitation.guests.map((guest) => guest.mealPreference)).toEqual(["unset", "unset"]);
  });

  it("a unique-index race on the email is reported as existing, and nothing else is written", async () => {
    fake.emailTaken = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { invitation, existing } = await createSimpleRegisteredInvitation(
      submission,
      SIMPLE,
    );
    expect(existing).toBe(true);
    expect(invitation.id).toBe("existing-group");
    expect(
      fake.writes.every((write) => write.table === "invitation_groups"),
    ).toBe(true);
  });
});
