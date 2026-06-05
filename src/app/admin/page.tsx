import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data-store";

export default async function Page() {
  const admin = await requireAdmin();
  const snapshot = await getAdminSnapshot();
  return <AdminDashboard admin={admin} snapshot={snapshot} />;
}
