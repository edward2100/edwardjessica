import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminSnapshot } from "@/lib/data-store";
import { weddingContent } from "@/lib/wedding-content";

// LR-3: the Supabase branch of the late markers, against a fake client. The
// guest-change read is its own query (the snapshot's history is capped at 100
// rows for Analytics), and a failing late read never breaks the admin page.
const GLOBAL = "2026-10-12T16:59:59.000Z";

type Op = [string, unknown[]];

const fake = vi.hoisted(() => ({
  queries: [] as Array<{ table: string; ops: Op[] }>,
  failLateQuery: false,
  failInvitations: false,
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

function invitationRow(id: string, submittedAt: string) {
  return {
    id,
    code: id.toUpperCase(),
    greeting: `Dear ${id}`,
    group_name: id,
    max_guests: 1,
    side: "joint",
    source: "admin",
    flow: "generic",
    eligible_events: ["dinner"],
    rsvps: [
      {
        id: `rsvp-${id}`,
        status: "attending",
        event_attendance: { dinner: true },
        submitted_at: submittedAt,
        updated_at: submittedAt,
        updated_by: "guest",
      },
    ],
    guests: [{ id: `guest-${id}`, name: id, meal_preference: "vegetarian" }],
  };
}

// One on-time answer later changed by the guest (15 Oct), one first answer
// after the deadline, and 150 newer admin rows that push the 15 Oct change
// out of the 100-row Analytics history.
const historyRows = [
  ...Array.from({ length: 150 }, (_, index) => ({
    id: `admin-${index}`,
    invitation_group_id: "busy-admin",
    status: "attending",
    changed_by: "admin",
    changed_at: new Date(Date.parse("2026-11-01T00:00:00.000Z") - index * 60_000).toISOString(),
    snapshot: {},
  })),
  {
    id: "guest-change",
    invitation_group_id: "old-change",
    status: "attending",
    changed_by: "guest",
    changed_at: "2026-10-15T03:00:00.000Z",
    snapshot: {},
  },
  {
    id: "guest-late",
    invitation_group_id: "first-late",
    status: "attending",
    changed_by: "guest",
    changed_at: "2026-10-16T03:00:00.000Z",
    snapshot: {},
  },
  {
    id: "guest-on-time",
    invitation_group_id: "old-change",
    status: "attending",
    changed_by: "guest",
    changed_at: "2026-10-05T03:00:00.000Z",
    snapshot: {},
  },
];

function opArgs(ops: Op[], name: string) {
  return ops.filter(([op]) => op === name).map(([, args]) => args);
}

function resolveQuery(table: string, ops: Op[]) {
  const columns = String(opArgs(ops, "select")[0]?.[0] ?? "");
  const filters = opArgs(ops, "eq");
  const limit = opArgs(ops, "limit")[0]?.[0] as number | undefined;
  if (table === "content_versions") {
    const status = filters.find(([column]) => column === "status")?.[1];
    return status === "published"
      ? {
          data: {
            content: { ...weddingContent, rsvpDeadline: GLOBAL },
            published_at: "2026-10-01T00:00:00.000Z",
          },
          error: null,
        }
      : { data: null, error: null };
  }
  if (table === "invitation_groups") {
    return fake.failInvitations
      ? { data: null, error: { message: "invitations unavailable" } }
      : {
          data: [
            invitationRow("old-change", "2026-10-05T03:00:00.000Z"),
            invitationRow("first-late", "2026-10-16T03:00:00.000Z"),
            invitationRow("busy-admin", "2026-10-01T03:00:00.000Z"),
          ],
          error: null,
        };
  }
  if (table === "rsvp_history") {
    if (columns === "invitation_group_id,changed_at") {
      if (fake.failLateQuery) return { data: null, error: { message: "late read failed" } };
      const rows = historyRows
        .filter((row) =>
          filters.every(([column, value]) => row[column as keyof typeof row] === value),
        )
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
        .slice(0, limit)
        .map(({ invitation_group_id, changed_at }) => ({ invitation_group_id, changed_at }));
      return { data: rows, error: null };
    }
    return {
      data: [...historyRows]
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
        .slice(0, limit),
      error: null,
    };
  }
  return { data: [], error: null };
}

function fakeQuery(table: string) {
  const ops: Op[] = [];
  fake.queries.push({ table, ops });
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order", "limit", "in", "is", "ilike", "gt"]) {
    builder[name] = (...args: unknown[]) => {
      ops.push([name, args]);
      return builder;
    };
  }
  builder.maybeSingle = async () => resolveQuery(table, ops);
  builder.single = async () => resolveQuery(table, ops);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected: (reason: unknown) => unknown,
  ) => Promise.resolve(resolveQuery(table, ops)).then(onFulfilled, onRejected);
  return builder;
}

afterEach(() => {
  fake.queries.length = 0;
  fake.failLateQuery = false;
  fake.failInvitations = false;
  vi.restoreAllMocks();
});

describe("late markers on Supabase (LR-3)", () => {
  it("reads guest changes with their own uncapped query, not the 100-row history", async () => {
    const snapshot = await getAdminSnapshot();
    expect(snapshot.history).toHaveLength(100);
    expect(
      snapshot.history.some((item) => item.invitationGroupId === "old-change"),
    ).toBe(false);
    expect(snapshot.lateResponses).toEqual({
      "old-change": { kind: "changed_late", at: "2026-10-15T03:00:00.000Z" },
      "first-late": { kind: "late", at: "2026-10-16T03:00:00.000Z" },
    });
    const lateQuery = fake.queries.find(
      ({ table, ops }) =>
        table === "rsvp_history" &&
        opArgs(ops, "select")[0]?.[0] === "invitation_group_id,changed_at",
    );
    expect(lateQuery).toBeDefined();
    expect(opArgs(lateQuery!.ops, "eq")).toEqual([["changed_by", "guest"]]);
    expect(opArgs(lateQuery!.ops, "limit")).toEqual([[5000]]);
  });

  it("a failing late query is logged and shows no markers; the snapshot still loads", async () => {
    fake.failLateQuery = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const snapshot = await getAdminSnapshot();
    expect(snapshot.lateResponses).toEqual({});
    expect(snapshot.invitations).toHaveLength(3);
    expect(snapshot.history).toHaveLength(100);
    expect(logged).toHaveBeenCalledWith(
      "[getAdminSnapshot] Unable to derive late RSVPs:",
      "late read failed",
    );
  });

  it("other read errors are not swallowed", async () => {
    fake.failInvitations = true;
    await expect(getAdminSnapshot()).rejects.toThrow("invitations unavailable");
  });
});
