import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { SEED_FAQS, SEED_FAQS_EN, SEED_PROGRAMS, SEED_PROGRAMS_EN, SEED_SETTINGS, type Program } from "@/data/catalog";
import {
  DEFAULT_HERO_EN,
  DEFAULT_IMAGES,
  DEFAULT_LANDING,
  DEFAULT_LANDING_EN,
  englishOverlay,
  mergeLanding,
  mergeSections,
  withFallback,
  type LandingCopy,
  type LandingImages,
  type SectionToggles,
} from "@/data/landing";
import { programLabelEn, type Lang } from "./i18n";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";

export type { Program };

export type Testimonial = { name: string; program_label: string; quote: string; photo_url?: string | null };
export type Faq = { question: string; answer: string };
export type Contact = { whatsapp: string; email: string; address: string };
export type Hero = {
  badge: string;
  title_start: string;
  title_accent: string;
  title_end: string;
  subtitle: string;
};

export type OpenBatch = { code: string; program_slug: string; start_date: string; schedule_label: string; seats_left: number };

export type SiteItemKind = "partner" | "tutor" | "gallery";
/** Kartu landing page yang sudah dipilih bahasanya. */
export type SiteCard = { id: string; title: string; subtitle: string; body: string; image_url: string | null };

export type LandingContent = {
  lang: Lang;
  programs: Program[];
  batches: OpenBatch[];
  faqs: Faq[];
  testimonials: Testimonial[];
  partners: SiteCard[];
  tutors: SiteCard[];
  gallery: SiteCard[];
  contact: Contact;
  hero: Hero;
  copy: LandingCopy;
  images: LandingImages;
  sections: SectionToggles;
  preview: boolean;
};

// Dibaca dengan "*" supaya website tetap tampil walau migrasi kolom English belum dijalankan.

/** Teks English sebuah kolom: isian English, lalu terjemahan bawaan bila teks Indonesia masih isi awal, lalu teks Indonesia. */
export const pickEn = (en: string | null | undefined, idText: string, seedId?: string, seedEn?: string) =>
  en?.trim() ? en : seedId !== undefined && seedEn && idText === seedId ? seedEn : idText;

const PROGRAM_KEYS = ["code", "slug", "name", "category", "entry_level", "duration_label", "capacity", "price_idr", "outcome", "evidence", "outcome_en", "evidence_en", "featured", "sort_order"] as const;
const pickProgram = (row: Record<string, unknown>) => Object.fromEntries(PROGRAM_KEYS.map((k) => [k, row[k]])) as Program & { outcome_en?: string; evidence_en?: string };

export function localizeProgram(p: Program & { outcome_en?: string; evidence_en?: string }, lang: Lang): Program {
  const { outcome_en, evidence_en, ...base } = p;
  if (lang === "id") return base;
  const seed = SEED_PROGRAMS.find((s) => s.slug === p.slug);
  const seedEn = SEED_PROGRAMS_EN[p.slug];
  return {
    ...base,
    outcome: pickEn(outcome_en, p.outcome, seed?.outcome, seedEn?.outcome),
    evidence: pickEn(evidence_en, p.evidence, seed?.evidence, seedEn?.evidence),
    duration_label: programLabelEn(p.duration_label),
    entry_level: programLabelEn(p.entry_level),
  };
}

function localizeFaq(f: Faq & { question_en?: string; answer_en?: string }, lang: Lang): Faq {
  if (lang === "id") return { question: f.question, answer: f.answer };
  const i = SEED_FAQS.findIndex((s) => s.question === f.question);
  const seedEn = i >= 0 ? SEED_FAQS_EN[i] : undefined;
  return {
    question: pickEn(f.question_en, f.question, SEED_FAQS[i]?.question, seedEn?.question),
    answer: pickEn(f.answer_en, f.answer, SEED_FAQS[i]?.answer, seedEn?.answer),
  };
}

type ItemRow = { id: string; kind: SiteItemKind; title: string; title_en: string; subtitle: string; subtitle_en: string; body: string; body_en: string; image_url: string | null };

const card = (r: ItemRow, lang: Lang): SiteCard => ({
  id: r.id,
  title: lang === "en" ? pickEn(r.title_en, r.title) : r.title,
  subtitle: lang === "en" ? pickEn(r.subtitle_en, r.subtitle) : r.subtitle,
  body: lang === "en" ? pickEn(r.body_en, r.body) : r.body,
  image_url: r.image_url,
});

/** Hero dan teks landing dalam bahasa tertentu. */
export function localizeCopy(lang: Lang, saved: { hero?: unknown; landing?: unknown; hero_en?: unknown; landing_en?: unknown }) {
  const hero = { ...(SEED_SETTINGS.hero as Hero), ...((saved.hero as Hero) ?? {}) };
  const copy = mergeLanding(saved.landing);
  if (lang === "id") return { hero, copy };
  return {
    hero: withFallback(englishOverlay(hero, SEED_SETTINGS.hero as Hero, DEFAULT_HERO_EN, saved.hero_en), hero),
    copy: withFallback(englishOverlay(copy, DEFAULT_LANDING, DEFAULT_LANDING_EN, saved.landing_en), copy),
  };
}

export const getLandingContent = cache(async (lang: Lang = "id"): Promise<LandingContent> => {
  if (!isSupabaseConfigured) {
    const { hero, copy } = localizeCopy(lang, {});
    return {
      lang,
      programs: SEED_PROGRAMS.map((p) => localizeProgram(p, lang)),
      batches: [],
      faqs: SEED_FAQS.map((f) => localizeFaq(f, lang)),
      testimonials: [],
      partners: [],
      tutors: [],
      gallery: [],
      contact: SEED_SETTINGS.contact as Contact,
      hero,
      copy,
      images: DEFAULT_IMAGES,
      sections: mergeSections(null),
      preview: true,
    };
  }

  // Konten publik dibaca sebagai pengunjung (tanpa cookie), sehingga halaman bisa di-cache.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const [programs, faqs, testimonials, settings, batches, items] = await Promise.all([
    supabase.from("programs").select("*").eq("status", "active").order("sort_order"),
    supabase.from("faqs").select("*").eq("published", true).order("sort_order"),
    supabase.from("testimonials").select("*").eq("published", true).order("sort_order").limit(3),
    supabase.from("site_settings").select("key, value").in("key", ["contact", "hero", "landing", "images", "hero_en", "landing_en", "sections"]),
    supabase.rpc("open_batches"),
    supabase.from("site_items").select("id, kind, title, title_en, subtitle, subtitle_en, body, body_en, image_url").eq("published", true).order("sort_order"),
  ]);

  const error = programs.error ?? faqs.error ?? testimonials.error ?? settings.error;
  if (error) throw new Error(`Gagal memuat konten landing page: ${error.message}`);

  const byKey = Object.fromEntries((settings.data ?? []).map((row) => [row.key, row.value]));
  const { hero, copy } = localizeCopy(lang, byKey);
  // Kartu baru bersifat pelengkap: bila tabelnya belum ada (migrasi belum dijalankan), bagian itu disembunyikan.
  const rows = items.error ? [] : ((items.data ?? []) as ItemRow[]);
  const cards = (kind: SiteItemKind) => rows.filter((r) => r.kind === kind).map((r) => card(r, lang));

  return {
    lang,
    programs: ((programs.data ?? []) as Program[]).map((p) => localizeProgram(pickProgram(p), lang)),
    // Jadwal batch bersifat pelengkap: jika gagal dimuat, katalog tetap tampil.
    batches: batches.error
      ? []
      : ((batches.data ?? []) as OpenBatch[]).map((b) => (lang === "en" ? { ...b, schedule_label: programLabelEn(b.schedule_label) } : b)),
    faqs: (faqs.data ?? []).map((f) => localizeFaq(f, lang)),
    testimonials: (testimonials.data ?? []).map((t) => ({
      name: t.name,
      program_label: lang === "en" ? pickEn(t.program_label_en, t.program_label) : t.program_label,
      quote: lang === "en" ? pickEn(t.quote_en, t.quote) : t.quote,
      photo_url: t.photo_url,
    })),
    partners: cards("partner"),
    tutors: cards("tutor"),
    gallery: cards("gallery").slice(0, 12),
    contact: { ...(SEED_SETTINGS.contact as Contact), ...(byKey.contact ?? {}) },
    hero,
    copy,
    images: { ...DEFAULT_IMAGES, ...(byKey.images ?? {}) },
    sections: mergeSections(byKey.sections),
    preview: false,
  };
});

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function whatsappLink(number: string, text = "Halo Milestone English, saya ingin konsultasi program.") {
  const digits = number.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
