import { NextResponse } from "next/server";
import { ensureInvitationEmailAllowed } from "@/lib/data-store";
import { getGuestAuthSession } from "@/lib/guest-auth";
import { normalizeInviteCode, validateInviteCode } from "@/lib/rsvp";

export async function GET(request: Request) {
  try {
    const session = await getGuestAuthSession();
    if (!session) return NextResponse.json({ verified: false });

    const url = new URL(request.url);
    const code = url.searchParams.get("code") || "";
    if (code && validateInviteCode(code)) {
      await ensureInvitationEmailAllowed(normalizeInviteCode(code), session.email);
    }

    return NextResponse.json({
      verified: true,
      email: session.email,
      verifiedAt: session.verifiedAt,
    });
  } catch {
    return NextResponse.json({ verified: false });
  }
}
