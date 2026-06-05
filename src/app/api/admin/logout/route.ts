import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseCookieClient } from "@/lib/supabase";

export async function POST() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseCookieClient();
    await supabase?.auth.signOut();
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
