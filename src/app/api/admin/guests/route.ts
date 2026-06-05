import { NextResponse } from "next/server";
import {
  deleteInvitationByAdmin,
  getAdminSnapshot,
  upsertInvitationByAdmin,
  upsertInvitationFromCsvRows
} from "@/lib/data-store";
import { buildGuestCsvTemplate, parseGuestCsv } from "@/lib/csv";
import { getCurrentAdmin } from "@/lib/auth";
import type { AdminInvitationUpsert } from "@/lib/types";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "template") {
    return new Response(buildGuestCsvTemplate(), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=edward-jessica-guest-template.csv"
      }
    });
  }

  return NextResponse.json(await getAdminSnapshot());
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { csv } = (await request.json()) as { csv?: string };
    if (!csv) return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
    const rows = parseGuestCsv(csv);
    const created = await upsertInvitationFromCsvRows(rows);
    return NextResponse.json({ created, snapshot: await getAdminSnapshot() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import guests." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = (await request.json()) as AdminInvitationUpsert;
    const invitation = await upsertInvitationByAdmin(payload);
    return NextResponse.json({ invitation, snapshot: await getAdminSnapshot() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save guest group." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { code } = (await request.json()) as { code?: string };
    if (!code) return NextResponse.json({ error: "Invitation code is required." }, { status: 400 });
    await deleteInvitationByAdmin(code);
    return NextResponse.json({ snapshot: await getAdminSnapshot() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete guest group." },
      { status: 400 }
    );
  }
}
