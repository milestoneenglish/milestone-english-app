import { placeholdersOf } from "@/lib/notify";
import { IMAGE_SLOTS, type ImageSlot } from "@/lib/ops";
import { listPrograms } from "@/lib/owner";
import { siteContent, templateList } from "@/lib/site";
import { Badge, EmptyState, Notice, PageHeader, Panel, Tabs } from "../ui";
import { ContactForm, FaqForm, HeroForm, ImageSlotForm, LandingForm, ProgramDescriptionForm, TemplateForm, TestimonialForm } from "./cms-forms";

// CMS website untuk Owner dan Admin. Harga dan buka/tutup program hanya di menu Owner (Program & Harga).

const TABS = {
  teks: "Teks landing",
  gambar: "Gambar",
  faq: "FAQ",
  testimoni: "Testimoni",
  program: "Deskripsi program",
  kontak: "Kontak",
  notifikasi: "Template notifikasi",
} as const;
type Tab = keyof typeof TABS;

// Gambar bawaan (sama dengan CSS landing page), untuk pratinjau di CMS.
const FALLBACK: Record<ImageSlot, string> = {
  hero: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=70",
  about: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1100&q=70",
  why: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1100&q=70",
};

export async function CmsPage({ role, params }: { role: "owner" | "admin"; params: Record<string, string | undefined> }) {
  const tab: Tab = params.tab && params.tab in TABS ? (params.tab as Tab) : "teks";
  const base = `/portal/${role}/cms`;
  const content = tab === "program" || tab === "notifikasi" ? null : await siteContent();
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="CMS Website"
        subtitle="Semua teks dan gambar di website publik. Perubahan langsung tampil setelah disimpan."
        action={
          <a href="/" target="_blank" rel="noopener noreferrer" className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
            Buka website ↗
          </a>
        }
      />
      <Tabs tabs={Object.entries(TABS).map(([key, label]) => ({ key, label, href: `${base}?tab=${key}` }))} active={tab} />

      {tab === "teks" && content && (
        <>
          <Panel title="Hero (bagian paling atas)">
            <HeroForm initial={content.hero} />
          </Panel>
          <Panel title="Bagian lain landing page">
            <LandingForm initial={content.copy} />
          </Panel>
        </>
      )}

      {tab === "gambar" && content && (
        <Panel title="Gambar latar">
          <div className="grid gap-6 md:grid-cols-3">
            {(Object.keys(IMAGE_SLOTS) as ImageSlot[]).map((slot) => (
              <ImageSlotForm key={slot} slot={slot} label={IMAGE_SLOTS[slot]} url={content.images[slot]} fallback={FALLBACK[slot]} />
            ))}
          </div>
        </Panel>
      )}

      {tab === "faq" && content && (
        <>
          <Panel title="Tambah FAQ">
            <FaqForm id={null} initial={{ question: "", answer: "", published: true, sort_order: content.faqs.length + 1 }} />
          </Panel>
          <Panel title={`FAQ (${content.faqs.length})`}>
            {content.faqs.length === 0 ? (
              <EmptyState icon="help" title="Belum ada FAQ" text="Bagian FAQ tidak tampil di website selama kosong." />
            ) : (
              <ul className="space-y-3">
                {content.faqs.map((f) => (
                  <li key={f.id}>
                    <details className="group rounded-2xl border border-orange/20 open:border-orange/50">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                        <span className="font-bold text-white">{f.question}</span>
                        {!f.published && <Badge>Disembunyikan</Badge>}
                      </summary>
                      <div className="border-t border-orange/15 px-5 py-5">
                        <FaqForm id={f.id} initial={f} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {tab === "testimoni" && content && (
        <>
          <Notice>Isi testimoni hanya dari peserta sungguhan, dengan izin mereka. Bagian testimoni tampil di website bila ada minimal satu yang ditampilkan (maksimal 3 teratas).</Notice>
          <Panel title="Tambah testimoni">
            <TestimonialForm id={null} initial={{ name: "", program_label: "", quote: "", published: false, sort_order: content.testimonials.length + 1 }} />
          </Panel>
          <Panel title={`Testimoni (${content.testimonials.length})`}>
            {content.testimonials.length === 0 ? (
              <EmptyState icon="star" title="Belum ada testimoni" />
            ) : (
              <ul className="space-y-3">
                {content.testimonials.map((t) => (
                  <li key={t.id}>
                    <details className="group rounded-2xl border border-orange/20 open:border-orange/50">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                        <span>
                          <span className="font-bold text-white">{t.name}</span>
                          <span className="ml-2 text-xs text-amber-200/70">{t.program_label}</span>
                        </span>
                        {t.published ? <Badge tone="green">Tampil</Badge> : <Badge>Disembunyikan</Badge>}
                      </summary>
                      <div className="border-t border-orange/15 px-5 py-5">
                        <TestimonialForm id={t.id} initial={t} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {tab === "program" && <ProgramDescriptions role={role} />}

      {tab === "kontak" && content && (
        <Panel title="Kontak di website">
          <ContactForm initial={content.contact} />
        </Panel>
      )}

      {tab === "notifikasi" && <Templates />}
    </div>
  );
}

async function ProgramDescriptions({ role }: { role: "owner" | "admin" }) {
  const programs = (await listPrograms()).filter((p) => p.status !== "archived");
  return (
    <>
      <Notice>
        Di sini hanya target dan bukti program yang diubah. {role === "owner" ? "Harga, kapasitas, dan buka/tutup program diatur di menu Program & Harga." : "Harga dan buka/tutup program diatur Owner."}
      </Notice>
      <ul className="space-y-3">
        {programs.map((p) => (
          <li key={p.id}>
            <details className="group workspace-panel">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <span>
                  <span className="text-xs font-black text-amber-200/80">{p.code}</span>
                  <span className="ml-3 font-black text-white">{p.name}</span>
                </span>
                <span className="text-xs text-orange group-open:hidden">Ubah ▾</span>
              </summary>
              <div className="border-t border-orange/15 px-5 py-5">
                <ProgramDescriptionForm id={p.id} outcome={p.outcome} evidence={p.evidence} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}

async function Templates() {
  const templates = await templateList();
  return (
    <>
      <Notice>Teks email dan WhatsApp otomatis. Isian dalam kurung kurawal, misalnya {"{name}"}, diganti data sebenarnya saat pesan dikirim. Jangan hapus isian yang penting seperti nominal atau batas waktu.</Notice>
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.key}>
            <details className="group workspace-panel">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span>
                  <span className="font-black text-white">{t.label}</span>
                  <span className="ml-2 text-xs text-amber-200/70">untuk {t.to}</span>
                </span>
                <span className="flex items-center gap-2">
                  {t.custom && <Badge tone="orange">Diubah</Badge>}
                  <span className="text-xs text-orange group-open:hidden">Ubah ▾</span>
                </span>
              </summary>
              <div className="border-t border-orange/15 px-5 py-5">
                <TemplateForm templateKey={t.key} current={t.current} original={t.original} custom={t.custom} placeholders={placeholdersOf(t.original)} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
