import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { AdminGuardians, AdminRegistrations } from "@/components/portal/views/admin";
import { GuardianChildren, GuardianHome } from "@/components/portal/views/guardian";
import { LeadPlacement, TutorPlacement } from "@/components/portal/views/placement-staff";
import { QuestionBank } from "@/components/portal/views/question-bank";
import { StudentHome, StudentPlacement } from "@/components/portal/views/student";
import { isRole, ROLE_LABEL, ROLE_MENU, type Role } from "@/lib/roles";
import { requireViewer, type Viewer } from "@/lib/session";

type ViewProps = { viewer: Viewer; params: Record<string, string | undefined> };

// Halaman yang sudah dibangun. Menu lain menampilkan status pembangunannya.
const VIEWS: Partial<Record<Role, Record<string, (p: ViewProps) => Promise<React.ReactNode>>>> = {
  student: {
    "": ({ viewer, params }) => StudentHome({ viewer, error: params.galat }),
    placement: ({ viewer, params }) => StudentPlacement({ viewer, error: params.galat }),
  },
  guardian: {
    "": ({ viewer, params }) => GuardianHome({ viewer, error: params.galat }),
    anak: ({ viewer, params }) => GuardianChildren({ viewer, error: params.galat }),
  },
  tutor: {
    placement: ({ viewer, params }) => TutorPlacement({ viewer, params }),
  },
  lead: {
    placement: ({ viewer, params }) => LeadPlacement({ viewer, params }),
    "bank-soal": ({ params }) => QuestionBank({ params }),
  },
  admin: {
    pendaftaran: ({ params }) => AdminRegistrations({ params }),
    "siswa-wali": () => AdminGuardians(),
  },
};

export default async function PortalSection({
  params,
  searchParams,
}: {
  params: Promise<{ role: string; section?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ role, section }, query] = await Promise.all([params, searchParams]);
  if (!isRole(role) || (section && section.length > 1)) notFound();
  const slug = section?.[0] ?? "";
  const item = ROLE_MENU[role].find((m) => m.slug === slug);
  if (!item) notFound();

  const viewer = await requireViewer();
  const view = VIEWS[role]?.[slug];
  if (view) return <div className="mx-auto max-w-6xl">{await view({ viewer, params: query })}</div>;

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
