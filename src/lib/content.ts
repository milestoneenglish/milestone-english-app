import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { SEED_FAQS, SEED_PROGRAMS, SEED_SETTINGS, type Program } from "@/data/catalog";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";

export type { Program };

export type Testimonial = { name: string; program_label: string; quote: string };
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

export type LandingContent = {
  programs: Program[];
  batches: OpenBatch[];
  faqs: Faq[];
  testimonials: Testimonial[];
  contact: Contact;
  hero: Hero;
  preview: boolean;
};

const PROGRAM_COLUMNS =
  "code, slug, name, category, entry_level, duration_label, capacity, price_idr, outcome, evidence, featured, sort_order";

export const getLandingContent = cache(async (): Promise<LandingContent> => {
  if (!isSupabaseConfigured) {
    return {
      programs: SEED_PROGRAMS,
      batches: [],
      faqs: SEED_FAQS,
      testimonials: [],
      contact: SEED_SETTINGS.contact as Contact,
      hero: SEED_SETTINGS.hero as Hero,
      preview: true,
    };
  }

  // Konten publik dibaca sebagai pengunjung (tanpa cookie), sehingga halaman bisa di-cache.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const [programs, faqs, testimonials, settings, batches] = await Promise.all([
    supabase.from("programs").select(PROGRAM_COLUMNS).eq("status", "active").order("sort_order"),
    supabase.from("faqs").select("question, answer").eq("published", true).order("sort_order"),
    supabase.from("testimonials").select("name, program_label, quote").eq("published", true).order("sort_order").limit(3),
    supabase.from("site_settings").select("key, value").in("key", ["contact", "hero"]),
    supabase.rpc("open_batches"),
  ]);

  const error = programs.error ?? faqs.error ?? testimonials.error ?? settings.error;
  if (error) throw new Error(`Gagal memuat konten landing page: ${error.message}`);

  const byKey = Object.fromEntries((settings.data ?? []).map((row) => [row.key, row.value]));

  return {
    programs: (programs.data ?? []) as Program[],
    // Jadwal batch bersifat pelengkap: jika gagal dimuat, katalog tetap tampil.
    batches: batches.error ? [] : ((batches.data ?? []) as OpenBatch[]),
    faqs: faqs.data ?? [],
    testimonials: testimonials.data ?? [],
    contact: { ...(SEED_SETTINGS.contact as Contact), ...(byKey.contact ?? {}) },
    hero: { ...(SEED_SETTINGS.hero as Hero), ...(byKey.hero ?? {}) },
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
