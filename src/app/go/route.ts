import { NextResponse } from "next/server";
import { normalizeInviteCode } from "@/lib/rsvp";

export function GET(request: Request) {
  const url = new URL(request.url);
  const code = normalizeInviteCode(url.searchParams.get("code") || "");
  if (!code) return NextResponse.redirect(new URL("/", url));
  return NextResponse.redirect(new URL(`/invite/${encodeURIComponent(code)}`, url));
}
