import "server-only";
import { SEED_SETTINGS } from "@/data/catalog";
import { DEFAULT_HERO_EN, DEFAULT_IMAGES, DEFAULT_LANDING, DEFAULT_LANDING_EN, englishOverlay, mergeLanding, mergeSections, SECTIONS, type LandingCopy, type LandingImages, type SectionToggles } from "@/data/landing";
import { ClassError, dbError } from "@/lib/classes";
import type { Contact, Faq, Hero, SiteItemKind, Testimonial } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { defaultTemplate, TEMPLATE_INFO, type EditableTemplate, type TemplateKey } from "@/lib/notify";
import { IMAGE_SLOTS, type ImageSlot } from "@/lib/ops";
import { BUCKETS, fileExists, fileExtension, publicUrl, signedUpload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// CMS website (khusus Owner): teks dan gambar landing page dalam dua bahasa, bagian yang tampil,
// FAQ, testimoni, kartu mitra/tutor/galeri, kontak, dan teks template notifikasi.
// Penulisan lewat sesi pengguna sehingga RLS (hanya Owner) berlaku.

export type FaqRow = Faq & { id: string; sort_order: number; published: boolean; question_en: string; answer_en: string };
export type TestimonialRow = Testimonial & { id: string; sort_order: number; published: boolean; program_label_en: string; quote_en: string; photo_url: string | null };
export type SiteItemRow = {
  id: string;
  kind: SiteItemKind;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  body: string;
  body_en: string;
  image_url: string | null;
  sort_order: number;
  published: boolean;
};

export type SiteContent = {
  hero: Hero;
  /** Isian English; "" berarti memakai teks Indonesia. */
  heroEn: Hero;
  contact: Contact;
  copy: LandingCopy;
  copyEn: LandingCopy;
  images: LandingImages;
  sections: SectionToggles;
  faqs: FaqRow[];
  testimonials: TestimonialRow[];
  items: SiteItemRow[];
};

const SETTING_KEYS = ["hero", "contact", "landing", "images", "hero_en", "landing_en", "sections"];

export async function siteContent(): Promise<SiteContent> {
  const admin = createAdminClient();
  const [{ data: settings }, { data: faqs }, { data: testimonials }, { data: items }] = await Promise.all([
    admin.from("site_settings").select("key, value").in("key", SETTING_KEYS),
    admin.from("faqs").select("*").order("sort_order"),
    admin.from("testimonials").select("*").order("sort_order"),
    admin.from("site_items").select("id, kind, title, title_en, subtitle, subtitle_en, body, body_en, image_url, sort_order, published").order("sort_order"),
  ]);
  const byKey = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
  const hero = { ...(SEED_SETTINGS.hero as Hero), ...(byKey.hero ?? {}) };
  const copy = mergeLanding(byKey.landing);
  return {
    hero,
    heroEn: englishOverlay(hero, SEED_SETTINGS.hero as Hero, DEFAULT_HERO_EN, byKey.hero_en),
    contact: { ...(SEED_SETTINGS.contact as Contact), ...(byKey.contact ?? {}) },
    copy,
    copyEn: englishOverlay(copy, DEFAULT_LANDING, DEFAULT_LANDING_EN, byKey.landing_en),
    images: { ...DEFAULT_IMAGES, ...(byKey.images ?? {}) },
    sections: mergeSections(byKey.sections),
    faqs: ((faqs ?? []) as FaqRow[]).map((f) => ({ ...f, question_en: f.question_en ?? "", answer_en: f.answer_en ?? "" })),
    testimonials: ((testimonials ?? []) as TestimonialRow[]).map((t) => ({ ...t, program_label_en: t.program_label_en ?? "", quote_en: t.quote_en ?? "", photo_url: t.photo_url ?? null })),
    items: (items ?? []) as SiteItemRow[],
  };
}

async function saveSetting(actorId: string, key: string, value: unknown) {
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert({ key, value, updated_by: actorId }, { onConflict: "key" });
  if (error) dbError(error, "Perubahan gagal disimpan.");
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action: "site_content_updated", entity: "site_settings", entity_id: key });
}

const trimAll = <T>(v: T, max = 600): T => {
  if (typeof v === "string") return v.trim().slice(0, max) as T;
  if (Array.isArray(v)) return v.map((x) => trimAll(x, max)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimAll(x, max)])) as T;
  return v;
};

// Versi English boleh dikosongkan per kolom; yang kosong tampil dalam bahasa Indonesia.
export async function saveHero(actorId: string, hero: Hero, lang: Lang = "id") {
  const h = trimAll(hero, 300);
  if (lang === "en") return saveSetting(actorId, "hero_en", h);
  if (!h.title_start || !h.title_accent || !h.subtitle) throw new ClassError("Judul dan subjudul hero wajib diisi.");
  await saveSetting(actorId, "hero", h);
}

export async function saveContact(actorId: string, contact: Contact) {
  const c = trimAll(contact, 300);
  c.whatsapp = c.whatsapp.replace(/[^\d+]/g, "");
  if (c.whatsapp && !/^\+?\d{8,15}$/.test(c.whatsapp)) throw new ClassError("Nomor WhatsApp 8–15 digit, contoh 081234567890.");
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new ClassError("Email kontak tidak valid.");
  await saveSetting(actorId, "contact", c);
}

// Teks landing disimpan utuh; mergeLanding menjaga jumlah butir sesuai tata letak.
export async function saveLanding(actorId: string, copy: LandingCopy, lang: Lang = "id") {
  const merged = mergeLanding(trimAll(copy));
  if (lang === "en") return saveSetting(actorId, "landing_en", merged);
  const empty = JSON.stringify(merged).match(/""/g)?.length ?? 0;
  if (empty) throw new ClassError("Semua kolom teks wajib diisi. Isi kolom yang masih kosong.");
  await saveSetting(actorId, "landing", merged);
}

export async function saveSections(actorId: string, toggles: Partial<SectionToggles>) {
  const clean = Object.fromEntries((Object.keys(SECTIONS) as (keyof SectionToggles)[]).map((k) => [k, toggles[k] !== false]));
  await saveSetting(actorId, "sections", clean);
}

export async function imageUploadTarget(slot: ImageSlot, mime: string, size: number) {
  if (!(slot in IMAGE_SLOTS)) throw new ClassError("Bagian gambar tidak dikenal.");
  return uploadTarget(`landing/${slot}`, mime, size);
}

async function uploadTarget(prefix: string, mime: string, size: number) {
  const ext = fileExtension("site", mime);
  if (!ext) throw new ClassError("Unggah gambar JPG, PNG, atau WEBP.");
  if (size > BUCKETS.site.maxBytes) throw new ClassError("Ukuran gambar maksimal 5 MB.");
  const path = `${prefix}-${Date.now()}.${ext}`;
  const token = await signedUpload("site", path);
  if (!token) throw new ClassError("Gambar gagal disiapkan untuk diunggah.");
  return { path, token };
}

// path kosong = kembali ke gambar bawaan.
export async function setImage(actorId: string, slot: ImageSlot, path: string) {
  if (!(slot in IMAGE_SLOTS)) throw new ClassError("Bagian gambar tidak dikenal.");
  if (path && (!path.startsWith(`landing/${slot}-`) || !(await fileExists("site", path)))) throw new ClassError("Gambar belum terunggah.");
  const { images } = await siteContent();
  await saveSetting(actorId, "images", { ...images, [slot]: path ? publicUrl("site", path) : "" });
}

// Foto testimoni, logo mitra, foto tutor, dan foto galeri: diunggah dulu, lalu alamat publiknya disimpan di kartu.
export const PHOTO_KINDS = ["testimonial", "partner", "tutor", "gallery"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export async function photoUploadTarget(kind: PhotoKind, mime: string, size: number) {
  if (!PHOTO_KINDS.includes(kind)) throw new ClassError("Jenis foto tidak dikenal.");
  return uploadTarget(`items/${kind}`, mime, size);
}

export async function uploadedPhotoUrl(kind: PhotoKind, path: string) {
  if (!PHOTO_KINDS.includes(kind) || !path.startsWith(`items/${kind}-`) || !(await fileExists("site", path))) throw new ClassError("Foto belum terunggah. Coba unggah ulang.");
  return publicUrl("site", path);
}

// Alamat gambar hanya boleh dari bucket gambar website sendiri.
function ownImage(url: string | null | undefined) {
  if (!url) return null;
  const prefix = publicUrl("site", "items/");
  if (!url.startsWith(prefix)) throw new ClassError("Foto tidak dikenal. Unggah ulang fotonya.");
  return url;
}

type ListTable = "faqs" | "testimonials" | "site_items";

const order = (n: number) => Math.max(-9999, Math.min(9999, Math.trunc(n) || 0));

export async function saveFaq(id: string | null, input: { question: string; answer: string; question_en: string; answer_en: string; published: boolean; sort_order: number }) {
  const row = {
    question: input.question.trim().slice(0, 200),
    answer: input.answer.trim().slice(0, 2000),
    question_en: (input.question_en ?? "").trim().slice(0, 200),
    answer_en: (input.answer_en ?? "").trim().slice(0, 2000),
    published: input.published,
    sort_order: order(input.sort_order),
  };
  if (row.question.length < 5 || row.answer.length < 5) throw new ClassError("Isi pertanyaan dan jawaban.");
  await saveRow("faqs", id, row);
}

// Testimoni hanya dari peserta sungguhan, dengan izin mereka.
export async function saveTestimonial(
  id: string | null,
  input: { name: string; program_label: string; quote: string; program_label_en: string; quote_en: string; photo_url: string | null; published: boolean; sort_order: number },
) {
  const row = {
    name: input.name.trim().slice(0, 80),
    program_label: input.program_label.trim().slice(0, 80),
    quote: input.quote.trim().slice(0, 600),
    program_label_en: (input.program_label_en ?? "").trim().slice(0, 80),
    quote_en: (input.quote_en ?? "").trim().slice(0, 600),
    photo_url: ownImage(input.photo_url),
    published: input.published,
    sort_order: order(input.sort_order),
  };
  if (row.name.length < 2 || row.program_label.length < 2 || row.quote.length < 10) throw new ClassError("Isi nama, program, dan kutipan testimoni.");
  await saveRow("testimonials", id, row);
}

export type SiteItemInput = Omit<SiteItemRow, "id" | "kind">;

export async function saveSiteItem(id: string | null, kind: SiteItemKind, input: SiteItemInput) {
  if (!["partner", "tutor", "gallery"].includes(kind)) throw new ClassError("Jenis kartu tidak dikenal.");
  const t = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);
  const row = {
    kind,
    title: t(input.title, 120),
    title_en: t(input.title_en, 120),
    subtitle: kind === "tutor" ? t(input.subtitle, 120) : "",
    subtitle_en: kind === "tutor" ? t(input.subtitle_en, 120) : "",
    body: kind === "tutor" ? t(input.body, 800) : "",
    body_en: kind === "tutor" ? t(input.body_en, 800) : "",
    image_url: ownImage(input.image_url),
    published: input.published,
    sort_order: order(input.sort_order),
  };
  if (kind !== "gallery" && row.title.length < 2) throw new ClassError(kind === "partner" ? "Isi nama instansi." : "Isi nama tutor.");
  if (kind !== "tutor" && !row.image_url) throw new ClassError(kind === "partner" ? "Unggah logo instansi." : "Unggah fotonya.");
  if (kind === "tutor" && (row.subtitle.length < 2 || row.body.length < 10)) throw new ClassError("Isi keahlian dan riwayat singkat tutor.");
  await saveRow("site_items", id, row);
}

async function saveRow(table: ListTable, id: string | null, row: object) {
  const supabase = await createClient();
  const { error } = id ? await supabase.from(table).update(row).eq("id", id) : await supabase.from(table).insert(row);
  if (error) dbError(error, "Perubahan gagal disimpan.");
}

export async function deleteRow(table: ListTable, id: string) {
  if (!["faqs", "testimonials", "site_items"].includes(table)) throw new ClassError("Data tidak dikenal.");
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) dbError(error, "Data gagal dihapus.");
}

// Tombol on/off di daftar kartu: hanya mengubah status tampil.
export async function setPublished(table: ListTable, id: string, published: boolean) {
  if (!["faqs", "testimonials", "site_items"].includes(table)) throw new ClassError("Data tidak dikenal.");
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ published }).eq("id", id);
  if (error) dbError(error, "Status tampil gagal diubah.");
}

// ---------------------------------------------------------------------------
// Template notifikasi
// ---------------------------------------------------------------------------

export type TemplateView = { key: TemplateKey; label: string; to: string; current: EditableTemplate; original: EditableTemplate; custom: boolean };

export async function templateList(): Promise<TemplateView[]> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "notification_templates").maybeSingle();
  const saved = (data?.value ?? {}) as Partial<Record<TemplateKey, EditableTemplate>>;
  return (Object.keys(TEMPLATE_INFO) as TemplateKey[]).map((key) => {
    const original = defaultTemplate(key);
    return { key, ...TEMPLATE_INFO[key]!, original, current: saved[key] ?? original, custom: Boolean(saved[key]) };
  });
}

// Simpan ubahan satu template; reset=true mengembalikan teks bawaan.
export async function saveTemplate(actorId: string, key: TemplateKey, value: EditableTemplate | null) {
  if (!TEMPLATE_INFO[key]) throw new ClassError("Template ini tidak bisa diubah.");
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "notification_templates").maybeSingle();
  const saved = { ...((data?.value ?? {}) as Record<string, EditableTemplate>) };
  if (value) {
    const t = { subject: value.subject.trim().slice(0, 200), body: value.body.trim().slice(0, 3000), cta: value.cta.trim().slice(0, 60) };
    if (t.subject.length < 3 || t.body.length < 5) throw new ClassError("Isi judul dan isi pesan.");
    const allowed = new Set([...`${defaultTemplate(key).subject} ${defaultTemplate(key).body}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    const unknown = [...`${t.subject} ${t.body}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !allowed.has(k));
    if (unknown.length) throw new ClassError(`Isian {${unknown[0]}} tidak tersedia untuk template ini.`);
    saved[key] = t;
  } else {
    delete saved[key];
  }
  await saveSetting(actorId, "notification_templates", saved);
}
