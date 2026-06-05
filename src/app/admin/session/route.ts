import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";
import { isDemoModeEnabled, isSupabaseConfigured, shouldUseSecureCookies } from "@/lib/env";
import { sampleAdmins } from "@/lib/seed";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").toLowerCase();
  const url = new URL(request.url);

  if (isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/admin/login?mode=supabase", url), 303);
  }

  if (!isDemoModeEnabled()) {
    return NextResponse.redirect(new URL("/admin/login?error=auth", url), 303);
  }

  const admin = sampleAdmins.find((item) => item.email.toLowerCase() === email);
  if (!admin) return NextResponse.redirect(new URL("/admin/login?error=admin", url), 303);

  const response = NextResponse.redirect(new URL("/admin", url), 303);
  response.cookies.set(ADMIN_COOKIE, admin.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}
