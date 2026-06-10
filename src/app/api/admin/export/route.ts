import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data-store";
import { serializeInvitationsCsv } from "@/lib/csv";
import { getSiteUrl } from "@/lib/env";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "csv";
  const snapshot = await getAdminSnapshot();
  if (format === "json") return NextResponse.json(snapshot);

  const rows = snapshot.invitations.flatMap((invitation) =>
    invitation.guests.map((guest) => ({
      groupName: invitation.groupName,
      greeting: invitation.greeting,
      code: invitation.code,
      inviteUrl: `${getSiteUrl()}/invite/${invitation.code}`,
      side: invitation.side,
      flow: invitation.flow,
      guestName: guest.name,
      mealPreference: guest.mealPreference,
      rsvpStatus: invitation.rsvp.status,
      events: invitation.eligibleEvents.join("|"),
      phone: invitation.phone,
      email: invitation.email,
    })),
  );
  return new Response(serializeInvitationsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        "attachment; filename=edward-jessica-rsvp-export.csv",
    },
  });
}
