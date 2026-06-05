import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/env";
import { sampleAdmins } from "@/lib/seed";
import { createSupabaseCookieClient, createSupabaseServiceClient } from "@/lib/supabase";
import type { AdminProfile } from "@/lib/types";

export const ADMIN_COOKIE = "ej_admin_demo";

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseCookieClient();
    const service = createSupabaseServiceClient();
    if (!supabase || !service) return null;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user?.email) return null;

    const { data } = await service
      .from("admin_profiles")
      .select("id,email,display_name,role")
      .eq("email", user.email)
      .maybeSingle();

    if (!data) return null;
    return {
      id: String(data.id),
      email: String(data.email),
      displayName: String(data.display_name),
      role: "super_admin"
    };
  }

  if (!isDemoModeEnabled()) return null;
  const cookieStore = await cookies();
  const email = cookieStore.get(ADMIN_COOKIE)?.value;
  return sampleAdmins.find((admin) => admin.email === email) || null;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
