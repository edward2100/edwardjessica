import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";
import { isDemoModeEnabled, isSupabaseConfigured, shouldUseSecureCookies } from "@/lib/env";
import { sampleAdmins } from "@/lib/seed";
import { createSupabaseCookieClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseCookieClient();
    const { error } =
      (await supabase?.auth.signInWithPassword({
        email,
        password
      })) || {};
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ ok: true });
  }

  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Supabase auth is not configured." }, { status: 503 });
  }

  const admin = sampleAdmins.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, admin.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}
