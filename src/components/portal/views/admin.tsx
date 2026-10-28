import { goalLabel } from "@/lib/placement/levels";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, EmptyState, formatDateTime, PageHeader, Panel, Tabs } from "../ui";
import { DecideButtons } from "./decide-buttons";
import { PlacementStatusBadge } from "./student";
import { ResetPasswordButton } from "./whatsapp-forms";

type Registrant = {
  id: string;
  full_name: string;
  birth_year: number | null;
  learning_goal: string;
  created_at: string;
  user_id: string | null;
  account: { email: string; phone: string | null } | null;
  program: { name: string } | null;
  guardian: { id: string; name: string; email: string; phone: string | null; status: string } | null;
  placement: string | null;
  level: string | null;
};

async function registrants(): Promise<Registrant[]> {
  const admin = createAdminClient();
  const [{ data: students }, { data: links }, { data: attempts }] = await Promise.all([
    admin
      .from("students")
      .select("id, full_name, birth_year, learning_goal, created_at, user_id, account:profiles!students_user_id_fkey(email, phone), program:programs(name)")
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("guardian_links").select("student_id, guardian_id, status, guardian:profiles!guardian_links_guardian_id_fkey(full_name, email, phone)"),
    admin.from("placement_attempts").select("student_id, status, levels, created_at").not("student_id", "is", null).order("created_at", { ascending: false }),
  ]);
  return (students ?? []).map((s) => {
    const link = links?.find((l) => l.student_id === s.id);
    const g = link?.guardian as unknown as { full_name: string; email: string; phone: string | null } | undefined;
    const attempt = attempts?.find((a) => a.student_id === s.id);
    return {
      ...(s as unknown as Omit<Registrant, "guardian" | "placement" | "level">),
      guardian: link && g ? { id: link.guardian_id, name: g.full_name, email: g.email, phone: g.phone, status: link.status } : null,
      placement: attempt?.status ?? null,
      level: (attempt?.levels as { overall?: string } | undefined)?.overall ?? null,
    };
  });
}

export async function AdminRegistrations({ params }: { params: Record<string, string | undefined> }) {
  const all = await registrants();
  const groups = {
    semua: all,
    belum: all.filter((r) => !r.placement || r.placement === "in_progress"),
    dinilai: all.filter((r) => r.placement === "awaiting_review" || r.placement === "reviewed"),
    terbit: all.filter((r) => r.placement === "published"),
  };
  const tab = (params.tab as keyof typeof groups) in groups ? (params.tab as keyof typeof groups) : "semua";
  const list = groups[tab];

  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Pendaftaran" subtitle="Semua calon siswa dan posisinya di perjalanan pendaftaran. Siswa/wali yang lupa password dibuatkan password sementara dari kolom Akun." />
      <Tabs
        active={tab}
        tabs={[
          { key: "semua", label: "Semua", count: groups.semua.length, href: "/portal/admin/pendaftaran" },
          { key: "belum", label: "Belum placement", count: groups.belum.length, href: "/portal/admin/pendaftaran?tab=belum" },
          { key: "dinilai", label: "Sedang dinilai", count: groups.dinilai.length, href: "/portal/admin/pendaftaran?tab=dinilai" },
          { key: "terbit", label: "Hasil terbit", count: groups.terbit.length, href: "/portal/admin/pendaftaran?tab=terbit" },
        ]}
      />
      <Panel>
        {list.length === 0 ? (
          <EmptyState icon="users" title="Belum ada pendaftar di bagian ini" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
                  <th className="py-2 pr-3 font-black">Siswa</th>
                  <th className="py-2 pr-3 font-black">Kontak</th>
                  <th className="py-2 pr-3 font-black">Minat & tujuan</th>
                  <th className="py-2 pr-3 font-black">Placement</th>
                  <th className="py-2 pr-3 font-black">Daftar</th>
                  <th className="py-2 font-black">Akun</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const contact = r.guardian ?? (r.account ? { name: "", email: r.account.email, phone: r.account.phone, status: "" } : null);
                  return (
                    <tr key={r.id} className="border-b border-orange/10 align-top">
                      <td className="py-3 pr-3">
                        <p className="font-bold text-white">{r.full_name}</p>
                        <p className="text-[11px] text-amber-200/70">{r.guardian ? `Anak · wali ${r.guardian.name}` : "Siswa mandiri"}{r.birth_year ? ` · lahir ${r.birth_year}` : ""}</p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-amber-100">
                        {contact?.email}
                        {contact?.phone && (
                          <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="block font-bold text-orange">
                            {contact.phone}
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-amber-100">
                        {r.program?.name ?? "Belum memilih"}
                        <span className="block text-amber-200/70">{goalLabel(r.learning_goal)}</span>
                      </td>
                      <td className="py-3 pr-3">
                        {r.placement ? <PlacementStatusBadge status={r.placement} /> : <Badge>Belum mulai</Badge>}
                        {r.level && <span className="ml-2 font-black text-orange">{r.level}</span>}
                      </td>
                      <td className="py-3 pr-3 text-xs text-amber-100">{formatDateTime(r.created_at)}</td>
                      <td className="py-3">
                        {r.user_id ? (
                          <ResetPasswordButton userId={r.user_id} label="Reset password" />
                        ) : r.guardian ? (
                          <ResetPasswordButton userId={r.guardian.id} label="Reset password wali" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export async function AdminGuardians() {
  const { data } = await createAdminClient()
    .from("guardian_links")
    .select("id, status, relationship, created_at, decided_at, guardian:profiles!guardian_links_guardian_id_fkey(full_name, email, phone), student:students(full_name, birth_year)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []).map((l) => ({
    ...l,
    guardian: l.guardian as unknown as { full_name: string; email: string; phone: string | null },
    student: l.student as unknown as { full_name: string; birth_year: number | null },
  }));
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  const relation: Record<string, string> = { orang_tua: "Orang tua", wali: "Wali", lainnya: "Lainnya" };

  const Row = ({ r, actions }: { r: (typeof rows)[number]; actions: boolean }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="font-bold text-white">
          {r.guardian.full_name || r.guardian.email} <span className="font-normal text-amber-200/80">→</span> {r.student.full_name}
        </p>
        <p className="text-xs text-amber-200/70">
          {relation[r.relationship]} · {r.guardian.email}
          {r.guardian.phone ? ` · ${r.guardian.phone}` : ""} · {r.student.birth_year ? `anak lahir ${r.student.birth_year}` : ""} · diajukan {formatDateTime(r.created_at)}
        </p>
      </div>
      {actions ? <DecideButtons linkId={r.id} /> : r.status === "verified" ? <Badge tone="green">Terverifikasi</Badge> : <Badge tone="red">Ditolak</Badge>}
    </li>
  );

  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Siswa & wali" subtitle="Verifikasi hubungan wali dan anak sebelum anak bisa didaftarkan ke kelas. Hubungi wali bila perlu konfirmasi." />
      <Panel title={`Menunggu verifikasi (${pending.length})`}>
        {pending.length === 0 ? <EmptyState icon="shield" title="Tidak ada yang menunggu" /> : <ul className="divide-y divide-orange/10">{pending.map((r) => <Row key={r.id} r={r} actions />)}</ul>}
      </Panel>
      {decided.length > 0 && (
        <Panel title="Sudah diputuskan">
          <ul className="divide-y divide-orange/10">
            {decided.map((r) => (
              <Row key={r.id} r={r} actions={false} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
