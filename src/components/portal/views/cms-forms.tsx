"use client";

import { useState } from "react";
import {
  deleteContentAction,
  photoUrlAction,
  prepareImageUpload,
  preparePhotoUpload,
  saveContactAction,
  saveFaqAction,
  saveHeroAction,
  saveLandingAction,
  saveSectionsAction,
  saveSiteItemAction,
  saveTemplateAction,
  saveTestimonialAction,
  setImageAction,
  setPublishedAction,
  updateProgramDescriptionAction,
} from "@/app/portal/ops-actions";
import { SECTIONS, type LandingCopy, type SectionKey, type SectionToggles } from "@/data/landing";
import type { Contact, Hero, SiteItemKind } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import type { EditableTemplate, TemplateKey } from "@/lib/notify";
import type { ImageSlot } from "@/lib/ops";
import { shrinkImage } from "@/lib/shrink-image";
import { createClient } from "@/lib/supabase/client";
import { danger, ErrorText, Field, ghost, useAction } from "./curriculum-forms";

type Table = "faqs" | "testimonials" | "site_items";

function SaveRow({ pending, saved, label = "Simpan" }: { pending: boolean; saved: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
        {pending ? "Menyimpan..." : label}
      </button>
      {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan dan tampil di website</span>}
    </div>
  );
}

// Di mode English kolom boleh kosong; contoh teks Indonesia tampil samar sebagai petunjuk.
function Text({ label, value, onChange, long = false, placeholder }: { label: string; value: string; onChange: (v: string) => void; long?: boolean; placeholder?: string }) {
  const required = placeholder === undefined;
  return (
    <Field label={label}>
      {long ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="field" required={required} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="field" required={required} placeholder={placeholder} />
      )}
    </Field>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-orange/20 p-5">
      <legend className="px-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">{title}</legend>
      {children}
    </fieldset>
  );
}

// Kolom English opsional di form kartu, disembunyikan sampai dibuka.
function EnglishFields({ filled, children }: { filled: boolean; children: React.ReactNode }) {
  return (
    <details open={filled} className="rounded-xl border border-orange/20 open:border-orange/40">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black text-orange">
        English (opsional) {filled ? "· terisi" : "· kosong, website English memakai teks Indonesia"}
      </summary>
      <div className="space-y-3 border-t border-orange/15 px-4 py-4">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Bagian yang tampil dan tombol on/off kartu
// ---------------------------------------------------------------------------

export function SectionsForm({ initial }: { initial: SectionToggles }) {
  const { pending, error, act, router } = useAction();
  const [s, setS] = useState(initial);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveSectionsAction(s), () => router.refresh(), "Bagian website tersimpan");
      }}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(SECTIONS) as SectionKey[]).map((k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-orange/20 px-4 py-3 text-sm has-[:checked]:border-orange/60">
              <span className="font-bold text-white">{SECTIONS[k]}</span>
              <span className="flex items-center gap-2 text-xs font-black">
                <span className={s[k] ? "text-emerald-300" : "text-slate-400"}>{s[k] ? "Tampil" : "Disembunyikan"}</span>
                <input type="checkbox" role="switch" className="h-4 w-4 accent-orange-500" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} aria-label={`Tampilkan ${SECTIONS[k]}`} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-200/70">Hero dan footer selalu tampil. Bagian yang berisi kartu (mitra, tutor, testimoni, galeri, FAQ) otomatis tersembunyi selama belum ada kartu yang ditampilkan.</p>
      <ErrorText error={error} />
      <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
        {pending ? "Menyimpan..." : "Simpan bagian website"}
      </button>
    </form>
  );
}

export function PublishToggle({ table, id, published }: { table: Table; id: string; published: boolean }) {
  const { pending, act, router } = useAction();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={published}
      disabled={pending}
      onClick={(e) => {
        // Berada di dalam judul kartu yang bisa dibuka; klik ini hanya mengubah status tampil.
        e.preventDefault();
        e.stopPropagation();
        act(() => setPublishedAction(table, id, !published), () => router.refresh(), published ? "Disembunyikan dari website" : "Tampil di website");
      }}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black transition ${
        published ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : "border-slate-500/50 bg-slate-500/10 text-slate-300"
      }`}
    >
      <span className={`relative h-3.5 w-6 rounded-full ${published ? "bg-emerald-400" : "bg-slate-600"}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${published ? "left-3" : "left-0.5"}`} />
      </span>
      {published ? "On" : "Off"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Foto kartu (testimoni, logo mitra, foto tutor, galeri)
// ---------------------------------------------------------------------------

type PhotoKind = "testimonial" | "partner" | "tutor" | "gallery";

function PhotoField({ kind, value, onChange, label, hint, round = false }: { kind: PhotoKind; value: string | null; onChange: (url: string | null) => void; label: string; hint: string; round?: boolean }) {
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-amber-100">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={`h-20 w-20 border border-orange/30 bg-white/5 ${round ? "rounded-full object-cover" : kind === "partner" ? "rounded-xl object-contain p-2" : "rounded-xl object-cover"}`} />
        ) : (
          <span className={`flex h-20 w-20 items-center justify-center border border-dashed border-orange/30 text-[11px] text-amber-200/60 ${round ? "rounded-full" : "rounded-xl"}`}>Belum ada</span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className={`${ghost} cursor-pointer`}>
            {step || (value ? "Ganti" : "Unggah")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={label}
              disabled={Boolean(step)}
              onChange={async (e) => {
                const picked = e.target.files?.[0];
                e.target.value = "";
                if (!picked) return;
                setError("");
                setStep("Memperkecil...");
                const file = await shrinkImage(picked, kind === "gallery" ? 1600 : 800, kind === "partner");
                setStep("Mengunggah...");
                const target = await preparePhotoUpload(kind, file.type, file.size);
                if (!target.ok) {
                  setStep("");
                  return setError(target.error);
                }
                const up = await createClient().storage.from("site-images").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
                if (up.error) {
                  setStep("");
                  return setError("Foto gagal diunggah. Periksa koneksi lalu coba lagi.");
                }
                const res = await photoUrlAction(kind, target.path);
                setStep("");
                if (!res.ok) return setError(res.error);
                onChange(res.url);
              }}
            />
          </label>
          {value && (
            <button type="button" onClick={() => onChange(null)} className={danger}>
              Hapus foto
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-amber-200/70">{hint}</p>
      <ErrorText error={error} />
    </div>
  );
}

function DeleteButton({ table, id, pending, act }: { table: Table; id: string; pending: boolean; act: ReturnType<typeof useAction>["act"] }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <>
      <button type="button" disabled={pending} onClick={() => act(() => deleteContentAction(table, id), undefined, "Dihapus")} className={danger}>
        Ya, hapus
      </button>
      <button type="button" onClick={() => setConfirm(false)} className={ghost}>
        Batal
      </button>
    </>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} className={danger}>
      Hapus
    </button>
  );
}

function ShowAndOrder({ published, sortOrder, onPublished, onOrder }: { published: boolean; sortOrder: number; onPublished: (v: boolean) => void; onOrder: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-5 text-sm text-amber-100">
      <label className="flex items-center gap-2">
        <input type="checkbox" className="accent-orange-500" checked={published} onChange={(e) => onPublished(e.target.checked)} /> Tampilkan di website
      </label>
      <label className="flex items-center gap-2">
        Urutan
        <input type="number" value={sortOrder} onChange={(e) => onOrder(Number(e.target.value))} className="field w-20" />
      </label>
      <span className="text-xs text-amber-200/60">Angka kecil tampil lebih dulu.</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teks landing page (Indonesia atau English)
// ---------------------------------------------------------------------------

export function HeroForm({ initial, lang = "id", source }: { initial: Hero; lang?: Lang; source?: Hero }) {
  const { pending, error, act, router } = useAction();
  const [h, setH] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Hero) => (v: string) => {
    setSaved(false);
    setH((x) => ({ ...x, [k]: v }));
  };
  const ph = (k: keyof Hero) => (lang === "en" ? (source?.[k] ?? "") : undefined);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveHeroAction(h, lang), () => (setSaved(true), router.refresh()));
      }}
    >
      <Text label="Label kecil di atas judul" value={h.badge} onChange={set("badge")} placeholder={ph("badge")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Text label="Judul bagian 1" value={h.title_start} onChange={set("title_start")} placeholder={ph("title_start")} />
        <Text label="Judul bagian 2" value={h.title_accent} onChange={set("title_accent")} placeholder={ph("title_accent")} />
        <Text label="Judul bagian 3" value={h.title_end} onChange={set("title_end")} placeholder={ph("title_end")} />
      </div>
      <Text label="Subjudul" value={h.subtitle} onChange={set("subtitle")} long placeholder={ph("subtitle")} />
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label={lang === "en" ? "Simpan hero (English)" : "Simpan bagian hero"} />
    </form>
  );
}

export function LandingForm({ initial, lang = "id", source }: { initial: LandingCopy; lang?: Lang; source?: LandingCopy }) {
  const { pending, error, act, router } = useAction();
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(false);
  // Mengubah satu nilai di dalam struktur teks landing (jalur seperti ["why", "items", 0, "title"]).
  const set = (path: (string | number)[]) => (v: string) => {
    setSaved(false);
    setC((prev) => {
      const next = structuredClone(prev) as unknown as Record<string | number, unknown>;
      let node = next;
      for (const k of path.slice(0, -1)) node = node[k] as Record<string | number, unknown>;
      node[path[path.length - 1]] = v;
      return next as unknown as LandingCopy;
    });
  };
  // Petunjuk teks Indonesia di setiap kolom saat mengisi versi English.
  const ph = (path: (string | number)[]): string | undefined => {
    if (lang !== "en" || !source) return undefined;
    let node: unknown = source;
    for (const k of path) node = (node as Record<string | number, unknown>)?.[k];
    return typeof node === "string" ? node : "";
  };
  const T = ({ label, path, long = false }: { label: string; path: (string | number)[]; long?: boolean }) => {
    let value: unknown = c;
    for (const k of path) value = (value as Record<string | number, unknown>)[k];
    return <Text label={label} value={value as string} onChange={set(path)} long={long} placeholder={ph(path)} />;
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveLandingAction(c, lang), () => (setSaved(true), router.refresh()));
      }}
    >
      <Group title="4 keunggulan (di bawah hero)">
        <div className="grid gap-4 sm:grid-cols-2">
          {c.benefits.map((_, i) => (
            <div key={i} className="space-y-3">
              {T({ label: `Keunggulan ${i + 1}: judul`, path: ["benefits", i, "title"] })}
              {T({ label: `Keunggulan ${i + 1}: penjelasan`, path: ["benefits", i, "text"], long: true })}
            </div>
          ))}
        </div>
      </Group>
      <Group title="Telah dipercaya oleh">
        {T({ label: "Judul deretan logo", path: ["partners", "title"] })}
      </Group>
      <Group title="Metode (About Us)">
        <div className="grid gap-4 sm:grid-cols-3">
          {T({ label: "Label kecil", path: ["about", "kicker"] })}
          {T({ label: "Judul", path: ["about", "title_start"] })}
          {T({ label: "Judul (lanjutan)", path: ["about", "title_accent"] })}
        </div>
        {T({ label: "Paragraf", path: ["about", "desc"], long: true })}
        <div className="grid gap-4 sm:grid-cols-3">
          {T({ label: "Foto: label kecil", path: ["about", "photo_kicker"] })}
          {T({ label: "Foto: judul", path: ["about", "photo_title"] })}
          {T({ label: "Foto: kalimat", path: ["about", "photo_text"] })}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {c.about.steps.map((_, i) => (
            <div key={i}>{T({ label: `Langkah ${i + 1}`, path: ["about", "steps", i] })}</div>
          ))}
        </div>
      </Group>
      <Group title="4 angka kunci">
        <div className="grid gap-4 sm:grid-cols-4">
          {c.stats.map((_, i) => (
            <div key={i} className="space-y-3">
              {T({ label: `Angka ${i + 1}`, path: ["stats", i, "value"] })}
              {T({ label: `Keterangan ${i + 1}`, path: ["stats", i, "label"] })}
            </div>
          ))}
        </div>
      </Group>
      <Group title="Bagian program">
        <div className="grid gap-4 sm:grid-cols-2">
          {T({ label: "Label kecil", path: ["programs", "kicker"] })}
          {T({ label: "Judul (diikuti jumlah program)", path: ["programs", "title_start"] })}
        </div>
        {T({ label: "Paragraf", path: ["programs", "desc"], long: true })}
      </Group>
      <Group title="Tutor kami">
        <div className="grid gap-4 sm:grid-cols-3">
          {T({ label: "Label kecil", path: ["tutors", "kicker"] })}
          {T({ label: "Judul", path: ["tutors", "title_start"] })}
          {T({ label: "Judul (lanjutan)", path: ["tutors", "title_accent"] })}
        </div>
        {T({ label: "Paragraf", path: ["tutors", "desc"] })}
      </Group>
      <Group title="Kenapa Milestone (Why Choose Us)">
        <div className="grid gap-4 sm:grid-cols-3">
          {T({ label: "Label kecil", path: ["why", "kicker"] })}
          {T({ label: "Judul", path: ["why", "title_start"] })}
          {T({ label: "Judul (lanjutan)", path: ["why", "title_accent"] })}
        </div>
        {T({ label: "Paragraf", path: ["why", "desc"], long: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {c.why.items.map((_, i) => (
            <div key={i} className="space-y-3">
              {T({ label: `Alasan ${i + 1}: judul`, path: ["why", "items", i, "title"] })}
              {T({ label: `Alasan ${i + 1}: penjelasan`, path: ["why", "items", i, "text"] })}
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {T({ label: "Kartu foto: label kecil", path: ["why", "card_kicker"] })}
          {T({ label: "Kartu foto: judul", path: ["why", "card_title"] })}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {c.why.chips.map((_, i) => (
            <div key={i}>{T({ label: `Label ${i + 1}`, path: ["why", "chips", i] })}</div>
          ))}
        </div>
      </Group>
      <Group title="Judul testimoni, galeri, dan FAQ">
        <div className="grid gap-4 sm:grid-cols-3">
          {T({ label: "Testimoni: label kecil", path: ["testimonials", "kicker"] })}
          {T({ label: "Testimoni: judul", path: ["testimonials", "title_start"] })}
          {T({ label: "Testimoni: judul (lanjutan)", path: ["testimonials", "title_accent"] })}
          {T({ label: "Galeri: label kecil", path: ["gallery", "kicker"] })}
          {T({ label: "Galeri: judul", path: ["gallery", "title_start"] })}
          {T({ label: "Galeri: judul (lanjutan)", path: ["gallery", "title_accent"] })}
        </div>
        {T({ label: "Galeri: paragraf", path: ["gallery", "desc"] })}
        <div className="grid gap-4 sm:grid-cols-3">
          {T({ label: "FAQ: label kecil", path: ["faq", "kicker"] })}
          {T({ label: "FAQ: judul", path: ["faq", "title_start"] })}
          {T({ label: "FAQ: judul (lanjutan)", path: ["faq", "title_accent"] })}
        </div>
        {T({ label: "FAQ: paragraf", path: ["faq", "desc"] })}
      </Group>
      <Group title="Footer">
        {T({ label: "Tentang Milestone English", path: ["footer", "about"], long: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {T({ label: "Judul ajakan", path: ["footer", "start_title"] })}
          {T({ label: "Kalimat ajakan", path: ["footer", "start_text"] })}
        </div>
      </Group>
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label={lang === "en" ? "Simpan teks landing (English)" : "Simpan teks landing page"} />
    </form>
  );
}

export function ContactForm({ initial }: { initial: Contact }) {
  const { pending, error, act, router } = useAction();
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveContactAction(c), () => (setSaved(true), router.refresh()));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp" hint="Dipakai tombol chat WhatsApp di website. Kosongkan untuk menyembunyikan tombol.">
          <input value={c.whatsapp} onChange={(e) => (setSaved(false), setC({ ...c, whatsapp: e.target.value }))} inputMode="tel" className="field" />
        </Field>
        <Field label="Email">
          <input type="email" value={c.email} onChange={(e) => (setSaved(false), setC({ ...c, email: e.target.value }))} className="field" />
        </Field>
      </div>
      <Field label="Alamat">
        <input value={c.address} onChange={(e) => (setSaved(false), setC({ ...c, address: e.target.value }))} className="field" />
      </Field>
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label="Simpan kontak" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Gambar latar
// ---------------------------------------------------------------------------

export function ImageSlotForm({ slot, label, url, fallback }: { slot: ImageSlot; label: string; url: string; fallback: string }) {
  const { pending, error, act } = useAction();
  const [step, setStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm font-black text-white">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url || fallback} alt={label} className="h-40 w-full rounded-xl border border-orange/20 object-cover" />
      <p className="text-xs text-amber-200/70">{url ? "Gambar unggahan" : "Gambar bawaan"} · JPG, PNG, atau WEBP, sebaiknya mendatar (lebar minimal 1200 px). Diperkecil otomatis sebelum diunggah.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${ghost} cursor-pointer`}>
          {step || "Ganti gambar"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={`Ganti ${label}`}
            disabled={Boolean(step) || pending}
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (!picked) return;
              setUploadError("");
              setStep("Memperkecil...");
              const file = await shrinkImage(picked, 2000);
              setStep("Mengunggah...");
              const target = await prepareImageUpload(slot, file.type, file.size);
              if (!target.ok) {
                setStep("");
                return setUploadError(target.error);
              }
              const up = await createClient().storage.from("site-images").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
              setStep("");
              if (up.error) return setUploadError("Gambar gagal diunggah. Periksa koneksi lalu coba lagi.");
              act(() => setImageAction(slot, target.path), undefined, "Gambar diunggah");
            }}
          />
        </label>
        {url && (
          <button type="button" disabled={pending} onClick={() => act(() => setImageAction(slot, ""), undefined, "Gambar dihapus")} className={danger}>
            Pakai gambar bawaan
          </button>
        )}
      </div>
      <ErrorText error={uploadError || error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ dan testimoni
// ---------------------------------------------------------------------------

type FaqValue = { question: string; answer: string; question_en: string; answer_en: string; published: boolean; sort_order: number };

export function FaqForm({ id, initial }: { id: string | null; initial: FaqValue }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof FaqValue>(k: K, v: FaqValue[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveFaqAction(id, f), () => (setSaved(true), !id && setF(initial), router.refresh()), id ? "Tersimpan" : "FAQ ditambahkan");
      }}
    >
      <Field label="Pertanyaan">
        <input value={f.question} onChange={(e) => set("question", e.target.value)} className="field" required />
      </Field>
      <Field label="Jawaban">
        <textarea value={f.answer} onChange={(e) => set("answer", e.target.value)} rows={3} className="field" required />
      </Field>
      <EnglishFields filled={Boolean(f.question_en || f.answer_en)}>
        <Text label="Question" value={f.question_en} onChange={(v) => set("question_en", v)} placeholder={f.question} />
        <Text label="Answer" value={f.answer_en} onChange={(v) => set("answer_en", v)} long placeholder={f.answer} />
      </EnglishFields>
      <ShowAndOrder published={f.published} sortOrder={f.sort_order} onPublished={(v) => set("published", v)} onOrder={(v) => set("sort_order", v)} />
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          {id ? "Simpan" : "Tambah FAQ"}
        </button>
        {id && <DeleteButton table="faqs" id={id} pending={pending} act={act} />}
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

type TestimonialValue = { name: string; program_label: string; quote: string; program_label_en: string; quote_en: string; photo_url: string | null; published: boolean; sort_order: number };

export function TestimonialForm({ id, initial }: { id: string | null; initial: TestimonialValue }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof TestimonialValue>(k: K, v: TestimonialValue[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveTestimonialAction(id, f), () => (setSaved(true), !id && setF(initial), router.refresh()), id ? "Tersimpan" : "Testimoni ditambahkan");
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama peserta">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} className="field" required />
        </Field>
        <Field label="Program / keterangan">
          <input value={f.program_label} onChange={(e) => set("program_label", e.target.value)} placeholder="Peserta SpeakUp" className="field" required />
        </Field>
      </div>
      <Field label="Kutipan">
        <textarea value={f.quote} onChange={(e) => set("quote", e.target.value)} rows={3} className="field" required />
      </Field>
      <PhotoField kind="testimonial" value={f.photo_url} onChange={(v) => set("photo_url", v)} label="Foto peserta (opsional)" hint="Foto wajah persegi. Tanpa foto, website menampilkan inisial nama." round />
      <EnglishFields filled={Boolean(f.program_label_en || f.quote_en)}>
        <Text label="Program / label" value={f.program_label_en} onChange={(v) => set("program_label_en", v)} placeholder={f.program_label || "SpeakUp learner"} />
        <Text label="Quote" value={f.quote_en} onChange={(v) => set("quote_en", v)} long placeholder={f.quote} />
      </EnglishFields>
      <ShowAndOrder published={f.published} sortOrder={f.sort_order} onPublished={(v) => set("published", v)} onOrder={(v) => set("sort_order", v)} />
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          {id ? "Simpan" : "Tambah testimoni"}
        </button>
        {id && <DeleteButton table="testimonials" id={id} pending={pending} act={act} />}
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kartu mitra (logo), tutor, dan galeri
// ---------------------------------------------------------------------------

export type SiteItemValue = {
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  body: string;
  body_en: string;
  image_url: string | null;
  published: boolean;
  sort_order: number;
};

const ITEM_TEXT: Record<SiteItemKind, { add: string; title: string; photo: string; hint: string }> = {
  partner: { add: "Tambah logo", title: "Nama instansi / sekolah", photo: "Logo", hint: "PNG atau WEBP berlatar transparan paling rapi. Diperkecil otomatis." },
  tutor: { add: "Tambah tutor", title: "Nama tutor", photo: "Foto tutor", hint: "Foto wajah persegi, latar polos. Diperkecil otomatis." },
  gallery: { add: "Tambah foto", title: "Keterangan foto (opsional)", photo: "Foto", hint: "Foto mendatar terlihat paling rapi. Diperkecil otomatis." },
};

export function SiteItemForm({ id, kind, initial }: { id: string | null; kind: SiteItemKind; initial: SiteItemValue }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  const text = ITEM_TEXT[kind];
  const set = <K extends keyof SiteItemValue>(k: K, v: SiteItemValue[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveSiteItemAction(id, kind, f), () => (setSaved(true), !id && setF(initial), router.refresh()), id ? "Tersimpan" : "Kartu ditambahkan");
      }}
    >
      <PhotoField kind={kind} value={f.image_url} onChange={(v) => set("image_url", v)} label={kind === "tutor" ? `${text.photo} (opsional)` : text.photo} hint={text.hint} round={kind === "tutor"} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={text.title}>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} className="field" required={kind !== "gallery"} maxLength={120} />
        </Field>
        {kind === "tutor" && (
          <Field label="Keahlian" hint="Contoh: IELTS & Academic Writing">
            <input value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} className="field" required maxLength={120} />
          </Field>
        )}
      </div>
      {kind === "tutor" && (
        <Field label="Riwayat singkat" hint="Pendidikan, sertifikat, dan pengalaman mengajar. Maksimal 800 karakter.">
          <textarea value={f.body} onChange={(e) => set("body", e.target.value)} rows={4} className="field" required maxLength={800} />
        </Field>
      )}
      {kind !== "partner" && (
        <EnglishFields filled={Boolean(f.title_en || f.subtitle_en || f.body_en)}>
          <Text label={kind === "tutor" ? "Name (if written differently)" : "Caption"} value={f.title_en} onChange={(v) => set("title_en", v)} placeholder={f.title} />
          {kind === "tutor" && (
            <>
              <Text label="Expertise" value={f.subtitle_en} onChange={(v) => set("subtitle_en", v)} placeholder={f.subtitle} />
              <Text label="Short background" value={f.body_en} onChange={(v) => set("body_en", v)} long placeholder={f.body} />
            </>
          )}
        </EnglishFields>
      )}
      <ShowAndOrder published={f.published} sortOrder={f.sort_order} onPublished={(v) => set("published", v)} onOrder={(v) => set("sort_order", v)} />
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          {id ? "Simpan" : text.add}
        </button>
        {id && <DeleteButton table="site_items" id={id} pending={pending} act={act} />}
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Deskripsi program (Owner)
// ---------------------------------------------------------------------------

export function ProgramDescriptionForm({ id, outcome, evidence, outcomeEn, evidenceEn }: { id: string; outcome: string; evidence: string; outcomeEn: string; evidenceEn: string }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState({ outcome, evidence, outcomeEn, evidenceEn });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => (setSaved(false), setF({ ...f, [k]: v }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => updateProgramDescriptionAction(id, f.outcome, f.evidence, f.outcomeEn, f.evidenceEn), () => (setSaved(true), router.refresh()));
      }}
    >
      <Field label="Target program (outcome)">
        <textarea value={f.outcome} onChange={(e) => set("outcome")(e.target.value)} rows={2} className="field" required />
      </Field>
      <Field label="Bukti hasil belajar">
        <textarea value={f.evidence} onChange={(e) => set("evidence")(e.target.value)} rows={2} className="field" required />
      </Field>
      <EnglishFields filled={Boolean(f.outcomeEn || f.evidenceEn)}>
        <Text label="Target outcome" value={f.outcomeEn} onChange={set("outcomeEn")} long placeholder={f.outcome} />
        <Text label="Evidence of progress" value={f.evidenceEn} onChange={set("evidenceEn")} long placeholder={f.evidence} />
      </EnglishFields>
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label="Simpan deskripsi" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Template notifikasi (Owner → Pengaturan)
// ---------------------------------------------------------------------------

export function TemplateForm({ templateKey, current, original, custom, placeholders }: { templateKey: TemplateKey; current: EditableTemplate; original: EditableTemplate; custom: boolean; placeholders: string[] }) {
  const { pending, error, act, router } = useAction();
  const [t, setT] = useState(current);
  const [saved, setSaved] = useState("");
  const set = (k: keyof EditableTemplate) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved("");
    setT((x) => ({ ...x, [k]: e.target.value }));
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveTemplateAction(templateKey, t), () => (setSaved("Tersimpan. Pesan berikutnya memakai teks ini."), router.refresh()));
      }}
    >
      <Field label="Judul (subjek email)">
        <input value={t.subject} onChange={set("subject")} className="field" required />
      </Field>
      <Field label="Isi pesan" hint="Pisahkan paragraf dengan baris kosong. Isian dalam kurung kurawal diganti otomatis saat pesan dikirim.">
        <textarea value={t.body} onChange={set("body")} rows={6} className="field font-mono text-xs" required />
      </Field>
      {original.cta && (
        <Field label="Teks tombol">
          <input value={t.cta} onChange={set("cta")} className="field" />
        </Field>
      )}
      {placeholders.length > 0 && (
        <p className="text-xs text-amber-200/80">
          Isian tersedia:{" "}
          {placeholders.map((p) => (
            <code key={p} className="mr-1.5 rounded bg-navy-dark px-1.5 py-0.5 text-orange">{`{${p}}`}</code>
          ))}
        </p>
      )}
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          Simpan template
        </button>
        {custom && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              act(
                () => saveTemplateAction(templateKey, null),
                () => {
                  setT(original);
                  setSaved("Kembali ke teks bawaan.");
                  router.refresh();
                },
              )
            }
            className={ghost}
          >
            Kembalikan teks bawaan
          </button>
        )}
        {saved && <span className="text-sm font-bold text-emerald-300">{saved}</span>}
      </div>
    </form>
  );
}
