import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { requireViewer } from "@/lib/session";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function PortalIndex() {
  const viewer = await requireViewer();
  if (viewer.roles.length > 0) redirect(`/portal/${viewer.roles[0]}`);

  return (
    <AuthShell kicker="Akun belum aktif" title="Akses belum diberikan" intro={`Akun ${viewer.email} belum memiliki role di sistem.`}>
      <p className="lp-muted text-sm leading-relaxed">Hubungi tim Milestone English agar role kamu diaktifkan. Setelah itu, masuk kembali untuk membuka portal.</p>
      <form action={signOut} className="mt-6">
        <button className="btn-orange rounded-xl px-6 py-3 text-sm">Keluar</button>
      </form>
    </AuthShell>
  );
}
