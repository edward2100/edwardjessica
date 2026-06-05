import { NextResponse } from "next/server";
import { createSelfRegisteredInvitation, getPublishedContent } from "@/lib/data-store";
import { isRsvpClosed, validateSelfRegistration } from "@/lib/rsvp";

export async function POST(request: Request) {
  try {
    const content = await getPublishedContent();
    if (isRsvpClosed(content.rsvpDeadline)) {
      return NextResponse.json({ error: "RSVP editing is closed." }, { status: 403 });
    }

    const payload = validateSelfRegistration(await request.json());
    const invitation = await createSelfRegisteredInvitation(payload);
    return NextResponse.json({ invitation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register RSVP." },
      { status: 400 }
    );
  }
}
