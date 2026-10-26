import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { isRole } from "@/lib/roles";
import { requireViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RoleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  const viewer = await requireViewer();
  // Role diperiksa di server; pengguna tidak bisa membuka portal role yang tidak dimilikinya.
  if (!viewer.roles.includes(role)) redirect("/portal");

  return (
    <PortalShell role={role} roles={viewer.roles} name={viewer.fullName || viewer.email} email={viewer.email}>
      {children}
    </PortalShell>
  );
}
