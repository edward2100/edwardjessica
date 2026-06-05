import { AdminLogin } from "@/components/admin/admin-login";
import { getCurrentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");
  return <AdminLogin />;
}
