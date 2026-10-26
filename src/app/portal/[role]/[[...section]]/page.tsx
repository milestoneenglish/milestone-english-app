import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { isRole, ROLE_LABEL, ROLE_MENU } from "@/lib/roles";
import { requireViewer } from "@/lib/session";

// Halaman menu portal. Isi tiap menu dibangun pada fase yang tercantum di spesifikasi;
// sampai saat itu halaman menampilkan status pembangunannya.
export default async function PortalSection({ params }: { params: Promise<{ role: string; section?: string[] }> }) {
  const { role, section } = await params;
  if (!isRole(role) || (section && section.length > 1)) notFound();
  const slug = section?.[0] ?? "";
  const item = ROLE_MENU[role].find((m) => m.slug === slug);
  if (!item) notFound();

  const viewer = await requireViewer();
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      {slug === "" && (
        <div>
          <h1 className="text-2xl font-black text-orange sm:text-3xl">Halo, {firstName}!</h1>
          <p className="mt-1 text-sm text-slate-400">Kamu masuk sebagai {ROLE_LABEL[role]}.</p>
        </div>
      )}

      <section className="workspace-panel p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange text-navy">
            <Icon name={item.icon} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Sedang dibangun · Fase {item.phase}</p>
            <h2 className="mt-1 text-xl font-black text-orange">{item.label}</h2>
            <p className="lp-muted mt-2 text-sm leading-relaxed">
              Menu ini sudah tersedia di struktur portal {ROLE_LABEL[role]}. Isinya diaktifkan pada Fase {item.phase} sesuai rencana pembangunan.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
