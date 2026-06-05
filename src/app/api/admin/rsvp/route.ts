import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdminSnapshot, updateRsvpByAdmin } from "@/lib/data-store";
import type { AdminRsvpUpdate } from "@/lib/types";

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = (await request.json()) as AdminRsvpUpdate;
    if (!payload.code || !payload.status) {
      return NextResponse.json({ error: "Invitation code and status are required." }, { status: 400 });
    }
    const invitation = await updateRsvpByAdmin(payload);
    return NextResponse.json({ invitation, snapshot: await getAdminSnapshot() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update RSVP." },
      { status: 400 }
    );
  }
}
