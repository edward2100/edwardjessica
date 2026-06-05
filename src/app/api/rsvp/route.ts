import { NextResponse } from "next/server";
import { getPublishedContent, submitRsvp } from "@/lib/data-store";
import { isRsvpClosed, validateRsvpSubmission } from "@/lib/rsvp";

export async function POST(request: Request) {
  try {
    const content = await getPublishedContent();
    if (isRsvpClosed(content.rsvpDeadline)) {
      return NextResponse.json({ error: "RSVP editing is closed." }, { status: 403 });
    }

    const payload = validateRsvpSubmission(await request.json());
    const invitation = await submitRsvp(payload, "guest");
    return NextResponse.json({ invitation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit RSVP." },
      { status: 400 }
    );
  }
}
