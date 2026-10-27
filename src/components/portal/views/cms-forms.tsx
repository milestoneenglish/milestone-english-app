"use client";

import { useState } from "react";
import {
  deleteContentAction,
  prepareImageUpload,
  saveContactAction,
  saveFaqAction,
  saveHeroAction,
  saveLandingAction,
  saveTemplateAction,
  saveTestimonialAction,
  setImageAction,
  updateProgramDescriptionAction,
} from "@/app/portal/ops-actions";
import type { LandingCopy } from "@/data/landing";
import type { Contact, Hero } from "@/lib/content";
import type { EditableTemplate, TemplateKey } from "@/lib/notify";
import type { ImageSlot } from "@/lib/ops";
import { createClient } from "@/lib/supabase/client";
import { danger, ErrorText, Field, ghost, useAction } from "./curriculum-forms";

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

function Text({ label, value, onChange, long = false }: { label: string; value: string; onChange: (v: string) => void; long?: boolean }) {
  return (
    <Field label={label}>
      {long ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="field" required />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="field" required />
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

// ---------------------------------------------------------------------------
// Teks landing page
// ---------------------------------------------------------------------------

export function HeroForm({ initial }: { initial: Hero }) {
  const { pending, error, act, router } = useAction();
  const [h, setH] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Hero) => (v: string) => {
    setSaved(false);
    setH((x) => ({ ...x, [k]: v }));
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveHeroAction(h), () => (setSaved(true), router.refresh()));
      }}
    >
      <Text label="Label kecil di atas judul" value={h.badge} onChange={set("badge")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Text label="Judul bagian 1" value={h.title_start} onChange={set("title_start")} />
        <Text label="Judul bagian 2" value={h.title_accent} onChange={set("title_accent")} />
        <Text label="Judul bagian 3" value={h.title_end} onChange={set("title_end")} />
      </div>
      <Text label="Subjudul" value={h.subtitle} onChange={set("subtitle")} long />
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label="Simpan bagian hero" />
    </form>
  );
}

export function LandingForm({ initial }: { initial: LandingCopy }) {
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
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveLandingAction(c), () => (setSaved(true), router.refresh()));
      }}
    >
      <Group title="4 keunggulan (di bawah hero)">
        <div className="grid gap-4 sm:grid-cols-2">
          {c.benefits.map((b, i) => (
            <div key={i} className="space-y-3">
              <Text label={`Keunggulan ${i + 1}: judul`} value={b.title} onChange={set(["benefits", i, "title"])} />
              <Text label={`Keunggulan ${i + 1}: penjelasan`} value={b.text} onChange={set(["benefits", i, "text"])} long />
            </div>
          ))}
        </div>
      </Group>
      <Group title="About Us">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Label kecil" value={c.about.kicker} onChange={set(["about", "kicker"])} />
          <Text label="Judul" value={c.about.title_start} onChange={set(["about", "title_start"])} />
          <Text label="Judul (lanjutan)" value={c.about.title_accent} onChange={set(["about", "title_accent"])} />
        </div>
        <Text label="Paragraf" value={c.about.desc} onChange={set(["about", "desc"])} long />
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Foto: label kecil" value={c.about.photo_kicker} onChange={set(["about", "photo_kicker"])} />
          <Text label="Foto: judul" value={c.about.photo_title} onChange={set(["about", "photo_title"])} />
          <Text label="Foto: kalimat" value={c.about.photo_text} onChange={set(["about", "photo_text"])} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {c.about.steps.map((s, i) => (
            <Text key={i} label={`Langkah ${i + 1}`} value={s} onChange={set(["about", "steps", i])} />
          ))}
        </div>
      </Group>
      <Group title="4 angka kunci">
        <div className="grid gap-4 sm:grid-cols-4">
          {c.stats.map((s, i) => (
            <div key={i} className="space-y-3">
              <Text label={`Angka ${i + 1}`} value={s.value} onChange={set(["stats", i, "value"])} />
              <Text label={`Keterangan ${i + 1}`} value={s.label} onChange={set(["stats", i, "label"])} />
            </div>
          ))}
        </div>
      </Group>
      <Group title="Bagian program">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Label kecil" value={c.programs.kicker} onChange={set(["programs", "kicker"])} />
          <Text label="Judul (diikuti jumlah program)" value={c.programs.title_start} onChange={set(["programs", "title_start"])} />
        </div>
        <Text label="Paragraf" value={c.programs.desc} onChange={set(["programs", "desc"])} long />
      </Group>
      <Group title="Why Choose Us">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Label kecil" value={c.why.kicker} onChange={set(["why", "kicker"])} />
          <Text label="Judul" value={c.why.title_start} onChange={set(["why", "title_start"])} />
          <Text label="Judul (lanjutan)" value={c.why.title_accent} onChange={set(["why", "title_accent"])} />
        </div>
        <Text label="Paragraf" value={c.why.desc} onChange={set(["why", "desc"])} long />
        <div className="grid gap-4 sm:grid-cols-2">
          {c.why.items.map((w, i) => (
            <div key={i} className="space-y-3">
              <Text label={`Alasan ${i + 1}: judul`} value={w.title} onChange={set(["why", "items", i, "title"])} />
              <Text label={`Alasan ${i + 1}: penjelasan`} value={w.text} onChange={set(["why", "items", i, "text"])} />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Kartu foto: label kecil" value={c.why.card_kicker} onChange={set(["why", "card_kicker"])} />
          <Text label="Kartu foto: judul" value={c.why.card_title} onChange={set(["why", "card_title"])} />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {c.why.chips.map((s, i) => (
            <Text key={i} label={`Label ${i + 1}`} value={s} onChange={set(["why", "chips", i])} />
          ))}
        </div>
      </Group>
      <Group title="Judul testimoni dan FAQ">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Testimoni: label kecil" value={c.testimonials.kicker} onChange={set(["testimonials", "kicker"])} />
          <Text label="Testimoni: judul" value={c.testimonials.title_start} onChange={set(["testimonials", "title_start"])} />
          <Text label="Testimoni: judul (lanjutan)" value={c.testimonials.title_accent} onChange={set(["testimonials", "title_accent"])} />
          <Text label="FAQ: label kecil" value={c.faq.kicker} onChange={set(["faq", "kicker"])} />
          <Text label="FAQ: judul" value={c.faq.title_start} onChange={set(["faq", "title_start"])} />
          <Text label="FAQ: judul (lanjutan)" value={c.faq.title_accent} onChange={set(["faq", "title_accent"])} />
        </div>
        <Text label="FAQ: paragraf" value={c.faq.desc} onChange={set(["faq", "desc"])} />
      </Group>
      <Group title="Footer">
        <Text label="Tentang Milestone English" value={c.footer.about} onChange={set(["footer", "about"])} long />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Judul ajakan" value={c.footer.start_title} onChange={set(["footer", "start_title"])} />
          <Text label="Kalimat ajakan" value={c.footer.start_text} onChange={set(["footer", "start_text"])} />
        </div>
      </Group>
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label="Simpan teks landing page" />
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
// Gambar
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
      <p className="text-xs text-amber-200/70">{url ? "Gambar unggahan" : "Gambar bawaan"} · JPG, PNG, atau WEBP maksimal 5 MB, sebaiknya mendatar (lebar minimal 1200 px).</p>
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
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploadError("");
              setStep("Mengunggah...");
              const target = await prepareImageUpload(slot, file.type, file.size);
              if (!target.ok) {
                setStep("");
                return setUploadError(target.error);
              }
              const up = await createClient().storage.from("site-images").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
              setStep("");
              if (up.error) return setUploadError("Gambar gagal diunggah. Periksa koneksi lalu coba lagi.");
              act(() => setImageAction(slot, target.path));
            }}
          />
        </label>
        {url && (
          <button type="button" disabled={pending} onClick={() => act(() => setImageAction(slot, ""))} className={danger}>
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

type FaqValue = { question: string; answer: string; published: boolean; sort_order: number };

export function FaqForm({ id, initial }: { id: string | null; initial: FaqValue }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveFaqAction(id, f), () => (setSaved(true), !id && setF(initial), router.refresh()));
      }}
    >
      <Field label="Pertanyaan">
        <input value={f.question} onChange={(e) => (setSaved(false), setF({ ...f, question: e.target.value }))} className="field" required />
      </Field>
      <Field label="Jawaban">
        <textarea value={f.answer} onChange={(e) => (setSaved(false), setF({ ...f, answer: e.target.value }))} rows={3} className="field" required />
      </Field>
      <div className="flex flex-wrap items-center gap-5 text-sm text-amber-100">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-orange-500" checked={f.published} onChange={(e) => (setSaved(false), setF({ ...f, published: e.target.checked }))} /> Tampilkan di website
        </label>
        <label className="flex items-center gap-2">
          Urutan
          <input type="number" value={f.sort_order} onChange={(e) => (setSaved(false), setF({ ...f, sort_order: Number(e.target.value) }))} className="field w-20" />
        </label>
      </div>
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          {id ? "Simpan" : "Tambah FAQ"}
        </button>
        {id &&
          (confirm ? (
            <>
              <button type="button" disabled={pending} onClick={() => act(() => deleteContentAction("faqs", id))} className={danger}>
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
          ))}
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

type TestimonialValue = { name: string; program_label: string; quote: string; published: boolean; sort_order: number };

export function TestimonialForm({ id, initial }: { id: string | null; initial: TestimonialValue }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof TestimonialValue>(k: K, v: TestimonialValue[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => saveTestimonialAction(id, f), () => (setSaved(true), !id && setF(initial), router.refresh()));
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
      <div className="flex flex-wrap items-center gap-5 text-sm text-amber-100">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-orange-500" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> Tampilkan di website
        </label>
        <label className="flex items-center gap-2">
          Urutan
          <input type="number" value={f.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className="field w-20" />
        </label>
      </div>
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          {id ? "Simpan" : "Tambah testimoni"}
        </button>
        {id &&
          (confirm ? (
            <>
              <button type="button" disabled={pending} onClick={() => act(() => deleteContentAction("testimonials", id))} className={danger}>
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
          ))}
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Deskripsi program (Admin dan Owner)
// ---------------------------------------------------------------------------

export function ProgramDescriptionForm({ id, outcome, evidence }: { id: string; outcome: string; evidence: string }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState({ outcome, evidence });
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => updateProgramDescriptionAction(id, f.outcome, f.evidence), () => (setSaved(true), router.refresh()));
      }}
    >
      <Field label="Target program (outcome)">
        <textarea value={f.outcome} onChange={(e) => (setSaved(false), setF({ ...f, outcome: e.target.value }))} rows={2} className="field" required />
      </Field>
      <Field label="Bukti hasil belajar">
        <textarea value={f.evidence} onChange={(e) => (setSaved(false), setF({ ...f, evidence: e.target.value }))} rows={2} className="field" required />
      </Field>
      <ErrorText error={error} />
      <SaveRow pending={pending} saved={saved} label="Simpan deskripsi" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Template notifikasi
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
