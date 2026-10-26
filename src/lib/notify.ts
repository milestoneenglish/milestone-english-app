import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Notifikasi email (Resend) dan WhatsApp (Fonnte). Setiap pesan dicatat di tabel notifications;
// selama API key belum diisi, pesan tercatat dengan status "skipped" dan tidak dikirim.
// Mengganti penyedia WhatsApp cukup lewat WHATSAPP_PROVIDER tanpa mengubah pemanggil.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export type Message = { subject: string; lines: string[]; cta?: { label: string; path: string } };

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export const TEMPLATES = {
  placement_submitted: (d: { name: string }): Message => ({
    subject: `Placement test ${d.name} sudah kami terima`,
    lines: [`Terima kasih, placement test ${d.name} sudah masuk.`, "Bagian writing dan speaking dinilai tutor paling lambat 1x24 jam. Hasil lengkap akan tampil di portal."],
    cta: { label: "Buka portal", path: "/portal" },
  }),
  placement_published: (d: { name: string; level: string }): Message => ({
    subject: `Hasil placement ${d.name} sudah terbit`,
    lines: [`Hasil placement test ${d.name} sudah terbit dengan level keseluruhan ${d.level}.`, "Lihat level per keterampilan dan program yang direkomendasikan, lalu pilih jadwal kelas."],
    cta: { label: "Lihat hasil dan pilih kelas", path: "/portal" },
  }),
  invoice_created: (d: { number: string; description: string; amount: number; due: string; bank: string }): Message => ({
    subject: `Tagihan ${d.number}: ${rupiah(d.amount)}`,
    lines: [
      `Kursi untuk ${d.description} sudah kami pegang.`,
      `Total: ${rupiah(d.amount)}. Batas pembayaran: ${d.due}.`,
      d.bank ? `Transfer ke ${d.bank}, lalu unggah bukti transfer di portal.` : "Instruksi transfer ada di menu Pembayaran portal.",
      "Lewat batas waktu, kursi dilepas otomatis.",
    ],
    cta: { label: "Bayar dan unggah bukti", path: "/portal" },
  }),
  proof_submitted: (d: { number: string; name: string; amount: number }): Message => ({
    subject: `Bukti bayar baru: ${d.number}`,
    lines: [`${d.name} mengunggah bukti transfer ${rupiah(d.amount)} untuk ${d.number}.`, "Mohon verifikasi dari menu Pembayaran."],
    cta: { label: "Verifikasi pembayaran", path: "/portal/admin/pembayaran" },
  }),
  payment_verified: (d: { number: string; program: string; name: string; start: string; schedule: string }): Message => ({
    subject: `Pembayaran terverifikasi, kelas ${d.program} aktif`,
    lines: [`Pembayaran ${d.number} sudah kami terima. Kelas ${d.program} untuk ${d.name} sekarang aktif.`, `Mulai ${d.start}, jadwal ${d.schedule}.`, "Buka portal untuk melihat tutor, link kelas, dan persiapan sesi pertama."],
    cta: { label: "Buka kelas", path: "/portal" },
  }),
  payment_rejected: (d: { number: string; reason: string; due: string }): Message => ({
    subject: `Bukti bayar ${d.number} perlu diunggah ulang`,
    lines: [`Bukti transfer untuk ${d.number} belum bisa kami terima.`, `Alasan: ${d.reason}.`, `Unggah ulang bukti yang benar sebelum ${d.due}.`],
    cta: { label: "Unggah ulang", path: "/portal" },
  }),
  tutor_new_student: (d: { name: string; batch: string; program: string }): Message => ({
    subject: `Siswa baru di batch ${d.batch}`,
    lines: [`${d.name} bergabung di batch ${d.batch} (${d.program}).`],
    cta: { label: "Lihat kelas", path: "/portal/tutor/kelas" },
  }),
  tutor_assigned: (d: { batch: string; program: string; start: string; schedule: string }): Message => ({
    subject: `Kamu ditugaskan mengajar batch ${d.batch}`,
    lines: [`Kamu ditugaskan mengajar ${d.program}, batch ${d.batch}.`, `Mulai ${d.start}, jadwal ${d.schedule}.`],
    cta: { label: "Lihat kelas", path: "/portal/tutor/kelas" },
  }),
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
type TemplateData<K extends TemplateKey> = Parameters<(typeof TEMPLATES)[K]>[0];

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function whatsappConfigured() {
  return (process.env.WHATSAPP_PROVIDER || "fonnte") === "fonnte" && Boolean(process.env.FONNTE_TOKEN);
}

function plainText(m: Message) {
  return [...m.lines, ...(m.cta ? [`${m.cta.label}: ${SITE_URL}${m.cta.path}`] : [])].join("\n\n");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function html(m: Message) {
  const body = m.lines.map((l) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(l)}</p>`).join("");
  const cta = m.cta
    ? `<p style="margin:24px 0 0"><a href="${SITE_URL}${m.cta.path}" style="background:#F97316;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(m.cta.label)}</a></p>`
    : "";
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0B1A33;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;color:#0B1A33"><p style="margin:0 0 20px;font-weight:900;color:#F97316;font-size:18px">Milestone English</p>${body}${cta}</div><p style="text-align:center;color:#94A3B8;font-size:12px;margin-top:16px">Pesan otomatis dari Milestone English</p></div>`;
}

async function sendEmail(to: string, m: Message) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: m.subject, html: html(m), text: plainText(m) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendWhatsapp(phone: string, m: Message) {
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: process.env.FONNTE_TOKEN! },
    body: new URLSearchParams({ target: phone.replace(/\D/g, ""), message: `*${m.subject}*\n\n${plainText(m)}` }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; reason?: string };
  if (!res.ok || json.status === false) throw new Error(`Fonnte: ${json.reason ?? res.status}`);
}

// Mengirim satu template ke beberapa penerima (id profil), lewat email dan WhatsApp bila nomornya ada.
// Tidak pernah melempar error: kegagalan kirim hanya tercatat di log.
export async function notify<K extends TemplateKey>(template: K, recipientIds: (string | null | undefined)[], data: TemplateData<K>, entity?: { type: string; id: string }) {
  const ids = [...new Set(recipientIds.filter(Boolean) as string[])];
  if (!ids.length) return;
  try {
    const admin = createAdminClient();
    const { data: profiles } = await admin.from("profiles").select("id, email, phone, status").in("id", ids);
    const message = (TEMPLATES[template] as (d: TemplateData<K>) => Message)(data);
    const jobs: { recipient_id: string; channel: "email" | "whatsapp"; destination: string; send: () => Promise<void>; ready: boolean }[] = [];
    for (const p of profiles ?? []) {
      if (p.status !== "active") continue;
      if (p.email) jobs.push({ recipient_id: p.id, channel: "email", destination: p.email, send: () => sendEmail(p.email, message), ready: emailConfigured() });
      if (p.phone) jobs.push({ recipient_id: p.id, channel: "whatsapp", destination: p.phone, send: () => sendWhatsapp(p.phone!, message), ready: whatsappConfigured() });
    }
    const rows = await Promise.all(
      jobs.map(async (j) => {
        let status: "sent" | "failed" | "skipped" = "skipped";
        let error: string | null = j.ready ? null : "Layanan pengirim belum dikonfigurasi";
        if (j.ready) {
          try {
            await j.send();
            status = "sent";
          } catch (e) {
            status = "failed";
            error = e instanceof Error ? e.message : String(e);
          }
        }
        return {
          recipient_id: j.recipient_id,
          channel: j.channel,
          destination: j.destination,
          template,
          subject: message.subject,
          body: plainText(message),
          status,
          error,
          entity: entity?.type ?? null,
          entity_id: entity?.id ?? null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        };
      }),
    );
    if (rows.length) await admin.from("notifications").insert(rows);
  } catch (e) {
    console.error("Notifikasi gagal dicatat", e);
  }
}

// Penerima untuk urusan seorang siswa: akun siswanya sendiri dan wali yang terhubung.
export async function studentRecipients(studentId: string) {
  const admin = createAdminClient();
  const [{ data: s }, { data: links }] = await Promise.all([
    admin.from("students").select("user_id").eq("id", studentId).maybeSingle(),
    admin.from("guardian_links").select("guardian_id").eq("student_id", studentId).neq("status", "rejected"),
  ]);
  return [s?.user_id, ...(links ?? []).map((l) => l.guardian_id)];
}

export async function roleRecipients(role: "admin" | "owner" | "lead") {
  const { data } = await createAdminClient().from("user_roles").select("user_id").eq("role", role);
  return (data ?? []).map((r) => r.user_id as string);
}
