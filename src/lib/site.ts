import "server-only";
import { SEED_SETTINGS } from "@/data/catalog";
import { DEFAULT_IMAGES, mergeLanding, type LandingCopy, type LandingImages } from "@/data/landing";
import { ClassError, dbError } from "@/lib/classes";
import type { Contact, Faq, Hero, Testimonial } from "@/lib/content";
import { defaultTemplate, TEMPLATE_INFO, type EditableTemplate, type TemplateKey } from "@/lib/notify";
import { IMAGE_SLOTS, type ImageSlot } from "@/lib/ops";
import { BUCKETS, fileExists, fileExtension, publicUrl, signedUpload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// CMS website untuk Owner dan Admin: teks dan gambar landing page, FAQ, testimoni, kontak,
// dan teks template notifikasi. Penulisan lewat sesi pengguna sehingga RLS site_settings berlaku.

export type FaqRow = Faq & { id: string; sort_order: number; published: boolean };
export type TestimonialRow = Testimonial & { id: string; sort_order: number; published: boolean };

export type SiteContent = {
  hero: Hero;
  contact: Contact;
  copy: LandingCopy;
  images: LandingImages;
  faqs: FaqRow[];
  testimonials: TestimonialRow[];
};

export async function siteContent(): Promise<SiteContent> {
  const admin = createAdminClient();
  const [{ data: settings }, { data: faqs }, { data: testimonials }] = await Promise.all([
    admin.from("site_settings").select("key, value").in("key", ["hero", "contact", "landing", "images"]),
    admin.from("faqs").select("id, question, answer, sort_order, published").order("sort_order"),
    admin.from("testimonials").select("id, name, program_label, quote, sort_order, published").order("sort_order"),
  ]);
  const byKey = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
  return {
    hero: { ...(SEED_SETTINGS.hero as Hero), ...(byKey.hero ?? {}) },
    contact: { ...(SEED_SETTINGS.contact as Contact), ...(byKey.contact ?? {}) },
    copy: mergeLanding(byKey.landing),
    images: { ...DEFAULT_IMAGES, ...(byKey.images ?? {}) },
    faqs: (faqs ?? []) as FaqRow[],
    testimonials: (testimonials ?? []) as TestimonialRow[],
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

export async function saveHero(actorId: string, hero: Hero) {
  const h = trimAll(hero, 300);
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
export async function saveLanding(actorId: string, copy: LandingCopy) {
  const merged = mergeLanding(trimAll(copy));
  const empty = JSON.stringify(merged).match(/""/g)?.length ?? 0;
  if (empty) throw new ClassError("Semua kolom teks wajib diisi. Isi kolom yang masih kosong.");
  await saveSetting(actorId, "landing", merged);
}


export async function imageUploadTarget(slot: ImageSlot, mime: string, size: number) {
  if (!(slot in IMAGE_SLOTS)) throw new ClassError("Bagian gambar tidak dikenal.");
  const ext = fileExtension("site", mime);
  if (!ext) throw new ClassError("Unggah gambar JPG, PNG, atau WEBP.");
  if (size > BUCKETS.site.maxBytes) throw new ClassError("Ukuran gambar maksimal 5 MB.");
  const path = `landing/${slot}-${Date.now()}.${ext}`;
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

type ListTable = "faqs" | "testimonials";

export async function saveFaq(id: string | null, input: { question: string; answer: string; published: boolean; sort_order: number }) {
  const row = { question: input.question.trim().slice(0, 200), answer: input.answer.trim().slice(0, 2000), published: input.published, sort_order: Math.trunc(input.sort_order) || 0 };
  if (row.question.length < 5 || row.answer.length < 5) throw new ClassError("Isi pertanyaan dan jawaban.");
  await saveRow("faqs", id, row);
}

// Testimoni hanya dari peserta sungguhan, dengan izin mereka.
export async function saveTestimonial(id: string | null, input: { name: string; program_label: string; quote: string; published: boolean; sort_order: number }) {
  const row = {
    name: input.name.trim().slice(0, 80),
    program_label: input.program_label.trim().slice(0, 80),
    quote: input.quote.trim().slice(0, 600),
    published: input.published,
    sort_order: Math.trunc(input.sort_order) || 0,
  };
  if (row.name.length < 2 || row.program_label.length < 2 || row.quote.length < 10) throw new ClassError("Isi nama, program, dan kutipan testimoni.");
  await saveRow("testimonials", id, row);
}

async function saveRow(table: ListTable, id: string | null, row: object) {
  const supabase = await createClient();
  const { error } = id ? await supabase.from(table).update(row).eq("id", id) : await supabase.from(table).insert(row);
  if (error) dbError(error, "Perubahan gagal disimpan.");
}

export async function deleteRow(table: ListTable, id: string) {
  if (table !== "faqs" && table !== "testimonials") throw new ClassError("Data tidak dikenal.");
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) dbError(error, "Data gagal dihapus.");
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
