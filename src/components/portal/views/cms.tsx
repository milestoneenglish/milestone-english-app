import { SEED_PROGRAMS, SEED_PROGRAMS_EN } from "@/data/catalog";
import { placeholdersOf } from "@/lib/notify";
import { IMAGE_SLOTS, type ImageSlot } from "@/lib/ops";
import { listPrograms } from "@/lib/owner";
import type { SiteItemKind } from "@/lib/content";
import { siteContent, templateList, type SiteItemRow } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, EmptyState, Notice, PageHeader, Panel, Tabs } from "../ui";
import {
  ContactForm,
  FaqForm,
  HeroForm,
  ImageSlotForm,
  LandingForm,
  ProgramDescriptionForm,
  PublishToggle,
  SectionsForm,
  SiteItemForm,
  TemplateForm,
  TestimonialForm,
  type SiteItemValue,
} from "./cms-forms";

// CMS website, khusus Owner. Harga dan buka/tutup program diatur di menu Program & Harga;
// template notifikasi di menu Pengaturan.

const TABS = {
  bagian: "Bagian website",
  teks: "Teks",
  gambar: "Gambar latar",
  mitra: "Telah dipercaya oleh",
  tutor: "Tutor kami",
  galeri: "Galeri",
  testimoni: "Testimoni",
  faq: "FAQ",
  program: "Deskripsi program",
  kontak: "Kontak",
} as const;
type Tab = keyof typeof TABS;

const ITEM_TAB: Partial<Record<Tab, SiteItemKind>> = {
  mitra: "partner",
  tutor: "tutor",
  galeri: "gallery",
};

const ITEM_INFO: Record<
  SiteItemKind,
  { add: string; list: string; empty: string; note: string }
> = {
  partner: {
    add: "Tambah logo",
    list: "Logo",
    empty:
      "Belum ada logo. Bagian “Telah dipercaya oleh” tidak tampil selama kosong.",
    note: "Logo instansi, sekolah, atau perusahaan yang pernah bekerja sama. Pastikan sudah ada izin menampilkan logonya.",
  },
  tutor: {
    add: "Tambah tutor",
    list: "Tutor",
    empty: "Belum ada tutor. Bagian “Tutor kami” tidak tampil selama kosong.",
    note: "Kartu ini terpisah dari akun tutor di portal: Anda bebas memilih siapa yang ditampilkan dan apa yang ditulis.",
  },
  gallery: {
    add: "Tambah foto",
    list: "Foto",
    empty: "Belum ada foto. Bagian galeri tidak tampil selama kosong.",
    note: "Maksimal 12 foto teratas yang tampil di website. Pengunjung bisa mengklik foto untuk melihatnya lebih besar.",
  },
};

// Gambar bawaan (sama dengan CSS landing page), untuk pratinjau di CMS.
const FALLBACK: Record<ImageSlot, string> = {
  hero: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=70",
  about:
    "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1100&q=70",
  why: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1100&q=70",
};

const itemValue = (r: SiteItemRow | null, sort: number): SiteItemValue => ({
  title: r?.title ?? "",
  title_en: r?.title_en ?? "",
  subtitle: r?.subtitle ?? "",
  subtitle_en: r?.subtitle_en ?? "",
  body: r?.body ?? "",
  body_en: r?.body_en ?? "",
  image_url: r?.image_url ?? null,
  published: r?.published ?? true,
  sort_order: r?.sort_order ?? sort,
});

function Thumb({
  url,
  round = false,
}: {
  url: string | null;
  round?: boolean;
}) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`h-10 w-10 shrink-0 border border-orange/20 bg-white/5 ${round ? "rounded-full object-cover" : "rounded-lg object-contain"}`}
    />
  ) : (
    <span
      className={`h-10 w-10 shrink-0 border border-dashed border-orange/30 ${round ? "rounded-full" : "rounded-lg"}`}
    />
  );
}

// Daftar kartu: satu baris per kartu dengan tombol on/off; form ubah terbuka saat baris diklik.
function CardList({
  children,
  count,
  title,
}: {
  children: React.ReactNode;
  count: number;
  title: string;
}) {
  return (
    <Panel title={`${title} (${count})`}>
      <ul className="space-y-2">{children}</ul>
    </Panel>
  );
}

function CardRow({
  summary,
  toggle,
  children,
}: {
  summary: React.ReactNode;
  toggle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <details className="group rounded-2xl border border-orange/20 open:border-orange/50">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-3">{summary}</span>
          <span className="flex items-center gap-3">
            {toggle}
            <span className="text-xs text-orange group-open:hidden">
              Ubah ▾
            </span>
          </span>
        </summary>
        <div className="border-t border-orange/15 px-5 py-5">{children}</div>
      </details>
    </li>
  );
}

export async function CmsPage({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  const tab: Tab =
    params.tab && params.tab in TABS ? (params.tab as Tab) : "bagian";
  const base = "/portal/owner/cms";
  const content = tab === "program" ? null : await siteContent();
  const english = params.bahasa === "en";
  const kind = ITEM_TAB[tab];
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="CMS Website"
        subtitle="Semua isi website publik dalam bahasa Indonesia dan English. Perubahan langsung tampil setelah disimpan."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10"
            >
              Buka website ↗
            </a>
            <a
              href="/en"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10"
            >
              Versi English ↗
            </a>
          </div>
        }
      />
      <Tabs
        tabs={Object.entries(TABS).map(([key, label]) => ({
          key,
          label,
          href: `${base}?tab=${key}`,
        }))}
        active={tab}
      />

      {tab === "bagian" && content && (
        <Panel title="Bagian yang tampil di website">
          <SectionsForm initial={content.sections} />
        </Panel>
      )}

      {tab === "teks" && content && (
        <>
          <Tabs
            active={english ? "en" : "id"}
            tabs={[
              {
                key: "id",
                label: "Bahasa Indonesia",
                href: `${base}?tab=teks`,
              },
              {
                key: "en",
                label: "English",
                href: `${base}?tab=teks&bahasa=en`,
              },
            ]}
          />
          {english && (
            <Notice>
              Kolom yang kosong tampil dalam bahasa Indonesia di website English
              (teks Indonesia terlihat samar di dalam kolom sebagai petunjuk).
              Isian awal adalah terjemahan bawaan; silakan dirapikan.
            </Notice>
          )}
          <Panel
            title={english ? "Hero (English)" : "Hero (bagian paling atas)"}
          >
            <HeroForm
              key={english ? "en" : "id"}
              initial={english ? content.heroEn : content.hero}
              lang={english ? "en" : "id"}
              source={content.hero}
            />
          </Panel>
          <Panel
            title={
              english
                ? "Bagian lain landing page (English)"
                : "Bagian lain landing page"
            }
          >
            <LandingForm
              key={english ? "en" : "id"}
              initial={english ? content.copyEn : content.copy}
              lang={english ? "en" : "id"}
              source={content.copy}
            />
          </Panel>
        </>
      )}

      {tab === "gambar" && content && (
        <Panel title="Gambar latar">
          <div className="grid gap-6 md:grid-cols-3">
            {(Object.keys(IMAGE_SLOTS) as ImageSlot[]).map((slot) => (
              <ImageSlotForm
                key={slot}
                slot={slot}
                label={IMAGE_SLOTS[slot]}
                url={content.images[slot]}
                fallback={FALLBACK[slot]}
              />
            ))}
          </div>
        </Panel>
      )}

      {kind && content && (
        <>
          <Notice>{ITEM_INFO[kind].note}</Notice>
          <Panel title={ITEM_INFO[kind].add}>
            <SiteItemForm
              id={null}
              kind={kind}
              initial={itemValue(
                null,
                content.items.filter((i) => i.kind === kind).length + 1,
              )}
            />
          </Panel>
          {(() => {
            const list = content.items.filter((i) => i.kind === kind);
            return list.length === 0 ? (
              <EmptyState icon="edit" title={ITEM_INFO[kind].empty} />
            ) : (
              <CardList title={ITEM_INFO[kind].list} count={list.length}>
                {list.map((r) => (
                  <CardRow
                    key={r.id}
                    summary={
                      <>
                        <Thumb url={r.image_url} round={kind === "tutor"} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-white">
                            {r.title || "Tanpa keterangan"}
                          </span>
                          {r.subtitle && (
                            <span className="block truncate text-xs text-amber-200/70">
                              {r.subtitle}
                            </span>
                          )}
                        </span>
                      </>
                    }
                    toggle={
                      <PublishToggle
                        table="site_items"
                        id={r.id}
                        published={r.published}
                      />
                    }
                  >
                    <SiteItemForm
                      id={r.id}
                      kind={kind}
                      initial={itemValue(r, r.sort_order)}
                    />
                  </CardRow>
                ))}
              </CardList>
            );
          })()}
        </>
      )}

      {tab === "faq" && content && (
        <>
          <Panel title="Tambah FAQ">
            <FaqForm
              id={null}
              initial={{
                question: "",
                answer: "",
                question_en: "",
                answer_en: "",
                published: true,
                sort_order: content.faqs.length + 1,
              }}
            />
          </Panel>
          {content.faqs.length === 0 ? (
            <EmptyState
              icon="help"
              title="Belum ada FAQ"
              text="Bagian FAQ tidak tampil di website selama kosong."
            />
          ) : (
            <CardList title="FAQ" count={content.faqs.length}>
              {content.faqs.map((f) => (
                <CardRow
                  key={f.id}
                  summary={
                    <span className="min-w-0">
                      <span className="block font-bold text-white">
                        {f.question}
                      </span>
                      {!f.question_en && (
                        <span className="block text-xs text-amber-200/60">
                          English belum diisi
                        </span>
                      )}
                    </span>
                  }
                  toggle={
                    <PublishToggle
                      table="faqs"
                      id={f.id}
                      published={f.published}
                    />
                  }
                >
                  <FaqForm id={f.id} initial={f} />
                </CardRow>
              ))}
            </CardList>
          )}
        </>
      )}

      {tab === "testimoni" && content && (
        <>
          <Notice>
            Isi testimoni hanya dari peserta sungguhan, dengan izin mereka.
            Bagian testimoni tampil bila ada minimal satu yang On (maksimal 3
            teratas).
          </Notice>
          <Panel title="Tambah testimoni">
            <TestimonialForm
              id={null}
              initial={{
                name: "",
                program_label: "",
                quote: "",
                program_label_en: "",
                quote_en: "",
                photo_url: null,
                published: false,
                sort_order: content.testimonials.length + 1,
              }}
            />
          </Panel>
          {content.testimonials.length === 0 ? (
            <EmptyState icon="star" title="Belum ada testimoni" />
          ) : (
            <CardList title="Testimoni" count={content.testimonials.length}>
              {content.testimonials.map((t) => (
                <CardRow
                  key={t.id}
                  summary={
                    <>
                      <Thumb url={t.photo_url} round />
                      <span className="min-w-0">
                        <span className="block font-bold text-white">
                          {t.name}
                        </span>
                        <span className="block text-xs text-amber-200/70">
                          {t.program_label}
                        </span>
                      </span>
                    </>
                  }
                  toggle={
                    <PublishToggle
                      table="testimonials"
                      id={t.id}
                      published={t.published}
                    />
                  }
                >
                  <TestimonialForm id={t.id} initial={t} />
                </CardRow>
              ))}
            </CardList>
          )}
        </>
      )}

      {tab === "program" && <ProgramDescriptions />}

      {tab === "kontak" && content && (
        <Panel title="Kontak di website">
          <ContactForm initial={content.contact} />
        </Panel>
      )}
    </div>
  );
}

async function ProgramDescriptions() {
  const [programs, { data: english }] = await Promise.all([
    listPrograms(),
    createAdminClient().from("programs").select("*"),
  ]);
  // Isian awal English: yang tersimpan, atau terjemahan bawaan selama teks Indonesia masih isi awal.
  const enOf = (p: {
    id: string;
    slug: string;
    outcome: string;
    evidence: string;
  }) => {
    const row = (english ?? []).find((r) => r.id === p.id) as
      { outcome_en?: string; evidence_en?: string } | undefined;
    const seed = SEED_PROGRAMS.find((s) => s.slug === p.slug);
    const seedEn = SEED_PROGRAMS_EN[p.slug];
    return {
      saved: Boolean(row?.outcome_en || row?.evidence_en),
      outcome:
        row?.outcome_en ||
        (seed && seed.outcome === p.outcome ? (seedEn?.outcome ?? "") : ""),
      evidence:
        row?.evidence_en ||
        (seed && seed.evidence === p.evidence ? (seedEn?.evidence ?? "") : ""),
    };
  };
  return (
    <>
      <Notice>
        Di sini target dan bukti program diubah, dalam bahasa Indonesia dan
        English. Harga, kapasitas, dan buka/tutup program diatur di menu Program
        &amp; Harga.
      </Notice>
      <ul className="space-y-3">
        {programs
          .filter((p) => p.status !== "archived")
          .map((p) => {
            const en = enOf(p);
            return (
              <li key={p.id}>
                <details className="group workspace-panel">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                    <span>
                      <span className="text-xs font-black text-amber-200/80">
                        {p.code}
                      </span>
                      <span className="ml-3 font-black text-white">
                        {p.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      {!en.saved && (
                        <Badge>
                          {en.outcome ? "English bawaan" : "English kosong"}
                        </Badge>
                      )}
                      <span className="text-xs text-orange group-open:hidden">
                        Ubah ▾
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-orange/15 px-5 py-5">
                    <ProgramDescriptionForm
                      id={p.id}
                      outcome={p.outcome}
                      evidence={p.evidence}
                      outcomeEn={en.outcome}
                      evidenceEn={en.evidence}
                    />
                  </div>
                </details>
              </li>
            );
          })}
      </ul>
    </>
  );
}

// Dipakai di Owner → Pengaturan.
export async function NotificationTemplates() {
  const templates = await templateList();
  return (
    <>
      <p className="mb-4 text-sm text-amber-100">
        Teks email dan WhatsApp otomatis. Isian dalam kurung kurawal, misalnya{" "}
        {"{name}"}, diganti data sebenarnya saat pesan dikirim. Jangan hapus
        isian yang penting seperti nominal atau batas waktu.
      </p>
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.key}>
            <details className="group rounded-2xl border border-orange/20 open:border-orange/50">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span>
                  <span className="font-black text-white">{t.label}</span>
                  <span className="ml-2 text-xs text-amber-200/70">
                    untuk {t.to}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {t.custom && <Badge tone="orange">Diubah</Badge>}
                  <span className="text-xs text-orange group-open:hidden">
                    Ubah ▾
                  </span>
                </span>
              </summary>
              <div className="border-t border-orange/15 px-5 py-5">
                <TemplateForm
                  templateKey={t.key}
                  current={t.current}
                  original={t.original}
                  custom={t.custom}
                  placeholders={placeholdersOf(t.original)}
                />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
