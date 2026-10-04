import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getDraftContent, publishDraftContent, saveDraftContent } from "@/lib/data-store";
import type { WeddingContent } from "@/lib/types";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ content: await getDraftContent() });
}

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const content = (await request.json()) as WeddingContent;
    return NextResponse.json({ content: await saveDraftContent(content) });
  } catch (error) {
    // DL-5: surface save refusals (e.g. a link deadline before the
    // rsvp_deadline migration) as a message the dashboard can show.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save draft." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = (await request.json()) as { action?: string };
  if (action !== "publish") return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  return NextResponse.json({ content: await publishDraftContent() });
}
