import { NextResponse } from "next/server";
import { getInvitationByVerifiedEmail } from "@/lib/data-store";
import { getGuestAuthSession } from "@/lib/guest-auth";
import type { InvitationGroup, PublicInviteFlow } from "@/lib/types";

function normalizeFlow(value: string | null): PublicInviteFlow | undefined {
  if (value === "generic" || value === "overseas" || value === "family") {
    return value;
  }
  return undefined;
}

function publicInvitation(invitation: InvitationGroup | null) {
  if (!invitation) return null;
  const { email: _email, phone: _phone, privateNotes: _notes, ...safeInvitation } = invitation;
  return {
    ...safeInvitation,
    emailClaimed: Boolean(invitation.email),
  };
}

export async function GET(request: Request) {
  try {
    const session = await getGuestAuthSession();
    if (!session?.email) return NextResponse.json({ verified: false });

    const url = new URL(request.url);
    const flow = normalizeFlow(url.searchParams.get("flow"));
    const invitation =
      (flow ? await getInvitationByVerifiedEmail(session.email, flow) : null) ||
      (await getInvitationByVerifiedEmail(session.email));

    return NextResponse.json({
      verified: true,
      email: session.email,
      invitation: publicInvitation(invitation),
    });
  } catch (error) {
    return NextResponse.json(
      {
        verified: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to resolve invitation.",
      },
      { status: 400 },
    );
  }
}
