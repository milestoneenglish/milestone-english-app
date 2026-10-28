// Uji ujung-ke-ujung Fase 2: batch, pilih kelas, invoice 2x24 jam, bukti bayar, verifikasi, onboarding, notifikasi.
// Membuat akun uji (@milestone.test), menjalankan alur lewat browser headless, lalu menghapus data uji
// dan mengembalikan pengaturan rekening seperti semula.
// Jalankan: npm run e2e:fase2   (server dev harus hidup di E2E_BASE, default http://localhost:3100)
// KEEP=1 untuk menyimpan data uji.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = new URL("../../e2e-output/fase2/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const created = { users: [], batches: [] };
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const password = () => `Uji${randomBytes(5).toString("hex")}7`;
const email = (who) => `e2e-${RUN}-${who}@milestone.test`;

async function makeUser(who, meta = {}, roles = []) {
  const pw = password();
  const { data, error } = await admin.auth.admin.createUser({
    email: email(who),
    password: pw,
    email_confirm: true,
    user_metadata: meta,
    app_metadata: roles.length ? { provisioned: true } : {},
  });
  if (error) throw new Error(`Gagal membuat ${who}: ${error.message}`);
  created.users.push(data.user.id);
  for (const role of roles) await admin.from("user_roles").insert({ user_id: data.user.id, role });
  if (roles.length) await admin.from("profiles").update({ full_name: meta.full_name ?? who }).eq("id", data.user.id);
  return { id: data.user.id, email: email(who), password: pw, name: meta.full_name, team: roles.length > 0 };
}

async function shot(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)), fullPage: true });
}

async function login(page, user) {
  await page.goto(`${BASE}/${user.team ? "tim" : "masuk"}`);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(/\/portal\/(student|guardian|tutor|lead|admin|owner)/, { timeout: 30000 });
}

async function open(page, path) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

const { data: programs } = await admin.from("programs").select("id, slug, name, duration_label").eq("status", "active");
const program = (slug) => programs.find((p) => p.slug === slug);

// Placement terbit langsung lewat database supaya uji fokus ke alur Fase 2.
async function publishPlacement(studentId, recommendedSlug) {
  await admin.from("placement_attempts").insert({
    student_id: studentId,
    status: "published",
    submitted_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    levels: { grammar: "A2", reading: "A2", listening: "A2", writing: "A2", speaking: "A1", overall: "A2" },
    auto_scores: {},
    recommended_program_ids: [program(recommendedSlug).id],
  });
}

function dateInDays(n) {
  const d = new Date(Date.now() + n * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

// PNG 1x1 sebagai bukti transfer uji.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function uploadProof(page, sender) {
  await page.locator("input[type=file]").first().setInputFiles({ name: "bukti.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Bank pengirim").first().selectOption("BCA");
  await page.getByPlaceholder("Sesuai buku tabungan").first().fill(sender);
  await page.getByRole("button", { name: "Kirim bukti transfer" }).first().click();
  await page.waitForSelector("text=Menunggu verifikasi", { timeout: 30000 });
}

const browser = await chromium.launch();
const pages = [];
const newPage = async () => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`  [console] ${m.text().slice(0, 300)}`));
  pages.push(page);
  return page;
};

const { data: originalPayment } = await admin.from("site_settings").select("value").eq("key", "payment").maybeSingle();

try {
  const owner = await makeUser("owner", { full_name: "Owner Uji" }, ["owner"]);
  const adm = await makeUser("admin", { full_name: "Admin Uji" }, ["admin"]);
  const tutor = await makeUser("tutor", { full_name: "Tutor Uji" }, ["tutor"]);
  const student = await makeUser("siswa", { full_name: "Siswa Uji", learning_goal: "percakapan", birth_year: "1999" });
  const other = await makeUser("lain", { full_name: "Siswa Lain" });
  const guardian = await makeUser("wali", { account_type: "guardian", full_name: "Wali Uji", child_name: "Anak Uji", child_birth_year: "2015" });
  const { data: sRow } = await admin.from("students").select("id").eq("user_id", student.id).single();
  const { data: child } = await admin.from("guardian_links").select("student_id").eq("guardian_id", guardian.id).single();
  await publishPlacement(sRow.id, "speakup");
  await publishPlacement(child.student_id, "speakup");

  // ---------------------------------------------------------------- Owner: rekening tujuan
  const op = await newPage();
  await login(op, owner);
  await open(op, "/portal/owner/pengaturan");
  await op.getByPlaceholder("BCA").fill("BCA");
  await op.getByLabel("Nomor rekening").fill("1234567890");
  await op.getByLabel("Nama pemilik rekening").fill("Milestone English Uji");
  await op.getByRole("button", { name: "Simpan rekening" }).click();
  await op.waitForSelector("text=Tersimpan", { timeout: 20000 });
  check("Owner menyimpan rekening tujuan transfer", true);
  check("Owner melihat status notifikasi belum dikonfigurasi", (await op.locator("text=Belum dikonfigurasi").count()) >= 1);

  // ---------------------------------------------------------------- Admin: buka batch
  const ap = await newPage();
  await login(ap, adm);
  check("Beranda admin menampilkan antrean Perlu tindakan", (await ap.locator("text=Bukti bayar menunggu verifikasi").count()) > 0);
  async function createBatch(slug, capacity) {
    await open(ap, "/portal/admin/batch?baru=1");
    const p = program(slug);
    await ap.locator("select").first().selectOption({ label: `${p.name} · ${p.duration_label}` });
    await ap.locator("input[type=date]").fill(dateInDays(7));
    await ap.getByRole("button", { name: "Selasa", exact: true }).click();
    await ap.getByRole("button", { name: "Kamis", exact: true }).click();
    await ap.getByLabel("Kapasitas").fill(String(capacity));
    await ap.locator("select").nth(1).selectOption({ label: "Tutor Uji" });
    await ap.getByPlaceholder("https://meet.google.com/...").fill("https://meet.google.com/uji-milestone");
    await ap.getByRole("button", { name: "Buat batch dan jadwal sesi" }).click();
    await ap.waitForURL(/\/portal\/admin\/batch\?id=/, { timeout: 30000 });
    const id = new URL(ap.url()).searchParams.get("id");
    created.batches.push(id);
    const { data } = await admin.from("batches").select("code, class_sessions(id)").eq("id", id).single();
    return { id, code: data.code, sessions: data.class_sessions.length };
  }
  const su = await createBatch("speakup", 6);
  check("Admin membuat batch SpeakUp dengan 8 sesi otomatis", su.sessions === 8, `${su.code}, ${su.sessions} sesi`);
  await shot(ap, "01-admin-batch-detail");
  const ez = await createBatch("english-zero", 1);
  check("Admin membuat batch kedua (English Zero, kapasitas 1)", Boolean(ez.code), ez.code);

  const guest = await newPage();
  await open(guest, "/");
  check("Landing menampilkan batch yang dibuka", (await guest.locator("text=/Batch berikutnya mulai/").count()) > 0);

  // ---------------------------------------------------------------- Siswa: mode Calon Siswa, pilih batch
  const sp = await newPage();
  await login(sp, student);
  const nav = sp.getByRole("navigation", { name: /Menu Siswa/ });
  check("Mode Calon Siswa: menu belajar disembunyikan", (await nav.getByText("Jadwal", { exact: true }).count()) === 0 && (await nav.getByText("Pilih Program").count()) === 1);
  check("Beranda siswa: langkah berikutnya pilih jadwal kelas", (await sp.locator("text=Pilih jadwal kelas").count()) > 0);
  await open(sp, "/portal/student/program");
  const suCard = sp.locator("div.rounded-2xl", { hasText: `Batch ${su.code}` }).first();
  const ezCard = sp.locator("div.rounded-2xl", { hasText: `Batch ${ez.code}` }).first();
  check("Batch program rekomendasi ditandai Direkomendasikan", (await suCard.getByText("Direkomendasikan").count()) === 1);
  await ezCard.getByRole("button", { name: "Pilih batch ini" }).click();
  check("Memilih program di luar rekomendasi memunculkan peringatan", (await ezCard.locator("text=/tidak termasuk rekomendasi placement/").count()) === 1);
  await ezCard.getByRole("button", { name: "Batal" }).click();
  await shot(sp, "02-siswa-pilih-batch");
  await suCard.getByRole("button", { name: "Pilih batch ini" }).click();
  await suCard.getByRole("button", { name: /Ya, pegang kursi/ }).click();
  await sp.waitForURL(/\/portal\/student\/pembayaran\?invoice=/, { timeout: 30000 });
  await sp.waitForLoadState("networkidle");
  const invoiceId = new URL(sp.url()).searchParams.get("invoice");
  const { data: inv } = await admin.from("invoices").select("number, amount_idr, due_at").eq("id", invoiceId).single();
  const hours = Math.round((Date.parse(inv.due_at) - Date.now()) / 3600000);
  check("Invoice terbit otomatis seharga program dengan batas 2x24 jam", inv.amount_idr === 349000 && hours === 48, `${inv.number}, ${hours} jam`);
  check("Halaman bayar menampilkan rekening tujuan", (await sp.locator("text=1234567890").count()) > 0);
  await shot(sp, "03-siswa-pembayaran");

  await uploadProof(sp, "Siswa Uji");
  check("Siswa mengunggah bukti, status menjadi Menunggu verifikasi", true);

  // ---------------------------------------------------------------- Admin: tolak, siswa unggah ulang, admin verifikasi
  await open(ap, "/portal/admin/pembayaran");
  const row = ap.locator("section", { hasText: inv.number }).first();
  check("Admin melihat bukti di antrean verifikasi", (await row.count()) === 1);
  await shot(ap, "04-admin-verifikasi");
  await row.getByRole("button", { name: "Tolak" }).click();
  await row.getByLabel("Alasan penolakan").selectOption({ index: 1 });
  await row.getByRole("button", { name: "Kirim penolakan" }).click();
  await row.getByRole("button", { name: "Kirim penolakan" }).waitFor({ state: "detached", timeout: 20000 });
  await open(sp, "/portal/student/pembayaran");
  check("Siswa melihat alasan penolakan", (await sp.locator("text=/Bukti sebelumnya ditolak: Nominal transfer tidak sesuai tagihan/").count()) > 0);
  await uploadProof(sp, "Siswa Uji");

  await open(ap, "/portal/admin/pembayaran");
  await ap.locator("section", { hasText: inv.number }).first().getByRole("button", { name: "Verifikasi dan aktifkan kelas" }).click();
  await ap.waitForSelector(`text=${inv.number}`, { state: "detached", timeout: 30000 }).catch(() => {});
  const { data: after } = await admin.from("invoices").select("status, enrollments(status)").eq("id", invoiceId).single();
  check("Verifikasi admin: invoice lunas dan kelas aktif", after.status === "paid" && after.enrollments.status === "active");

  // ---------------------------------------------------------------- Siswa: onboarding, mode Siswa, kuitansi
  await open(sp, "/portal/student");
  check("Onboarding: halaman sambutan dengan tutor dan link kelas", (await sp.locator("text=Kamu resmi bergabung di SpeakUp!").count()) === 1 && (await sp.locator("text=https://meet.google.com/uji-milestone").count()) > 0);
  check("Mode Siswa: menu belajar tampil setelah pembayaran terverifikasi", (await nav.getByText("Jadwal", { exact: true }).count()) === 1);
  await shot(sp, "05-siswa-onboarding");
  await sp.getByRole("button", { name: /Saya siap mulai/ }).click();
  await sp.waitForSelector("text=/Kelas aktif · SpeakUp/", { timeout: 20000 });
  check("Setelah onboarding: kartu kelas aktif dengan tombol Masuk kelas", (await sp.getByRole("link", { name: /Masuk kelas/ }).count()) > 0);
  await shot(sp, "06-siswa-kelas-aktif");
  await open(sp, `/kuitansi/${invoiceId}`);
  check("Kuitansi lunas bisa dibuka siswa", (await sp.getByText("KUITANSI", { exact: true }).count()) === 1 && (await sp.locator("text=/Status: LUNAS/").count()) === 1);
  await shot(sp, "07-kuitansi");

  // ---------------------------------------------------------------- Tutor
  const tp = await newPage();
  await login(tp, tutor);
  await open(tp, "/portal/tutor/kelas");
  check("Tutor melihat batch dan siswa barunya", (await tp.locator(`text=Batch ${su.code}`).count()) === 1 && (await tp.locator("text=Siswa Uji").count()) === 1);

  // ---------------------------------------------------------------- Wali: menunggu verifikasi, lalu pilih batch, lalu kedaluwarsa
  const gp = await newPage();
  await login(gp, guardian);
  check("Wali menunggu verifikasi hubungan sebelum memilih kelas", (await gp.locator("text=/sedang diverifikasi/").count()) > 0);
  await open(ap, "/portal/admin/siswa-wali");
  await ap.locator("li", { hasText: "Anak Uji" }).getByRole("button", { name: "Verifikasi" }).click();
  await ap.locator("li", { hasText: "Anak Uji" }).getByText("Terverifikasi").waitFor({ timeout: 20000 });
  await open(gp, `/portal/guardian/program?anak=${child.student_id}`);
  const gCard = gp.locator("div.rounded-2xl", { hasText: `Batch ${ez.code}` }).first();
  await gCard.getByRole("button", { name: "Pilih batch ini" }).click();
  await gCard.getByRole("button", { name: /Ya, pegang kursi/ }).click();
  await gp.waitForURL(/\/portal\/guardian\/pembayaran\?invoice=/, { timeout: 30000 });
  const gInvoice = new URL(gp.url()).searchParams.get("invoice");
  check("Wali memilih batch untuk anak dan invoice terbit", Boolean(gInvoice));
  const { data: full } = await admin.rpc("open_batches");
  check("Batch kapasitas 1 menjadi penuh", full.find((b) => b.code === ez.code)?.seats_left === 0);
  await admin.from("invoices").update({ due_at: new Date(Date.now() - 60000).toISOString() }).eq("id", gInvoice);
  await open(gp, "/portal/guardian/pembayaran");
  check("Invoice lewat 2x24 jam menjadi Kedaluwarsa", (await gp.locator("text=Kedaluwarsa").count()) > 0);
  const { data: freed } = await admin.rpc("open_batches");
  check("Kursi dari invoice kedaluwarsa kembali tersedia", freed.find((b) => b.code === ez.code)?.seats_left === 1);

  // ---------------------------------------------------------------- Keamanan
  const xp = await newPage();
  await login(xp, other);
  await open(xp, `/kuitansi/${invoiceId}`);
  check("Siswa lain tidak bisa membuka kuitansi orang lain", (await xp.getByText("KUITANSI", { exact: true }).count()) === 0);
  await open(xp, "/portal/admin/pembayaran");
  check("Siswa tidak bisa membuka halaman pembayaran admin", !xp.url().includes("/portal/admin"));
  await open(xp, "/portal/student/jadwal");
  check("Menu belajar dikunci untuk calon siswa (dialihkan ke beranda)", new URL(xp.url()).pathname === "/portal/student");

  // ---------------------------------------------------------------- Notifikasi tercatat
  const { data: notes } = await admin.from("notifications").select("template, status, channel").in("recipient_id", created.users);
  const templates = new Set((notes ?? []).map((n) => n.template));
  const expected = ["tutor_assigned", "invoice_created", "proof_submitted", "payment_rejected", "payment_verified", "tutor_new_student"];
  check(
    "Semua notifikasi alur tercatat (belum dikirim karena API key kosong)",
    expected.every((t) => templates.has(t)) && (notes ?? []).every((n) => n.status === "skipped"),
    `${notes?.length ?? 0} pesan; kurang: ${expected.filter((t) => !templates.has(t)).join(", ") || "-"}`,
  );
} catch (e) {
  check("Skenario berjalan tanpa error", false, e.message.split("\n")[0]);
  for (const [i, p] of pages.entries()) {
    await shot(p, `gagal-${i}`).catch(() => {});
    const alerts = await p.locator("[role=alert]").allInnerTexts().catch(() => []);
    if (alerts.length) console.log(`  [halaman ${i}] pesan: ${alerts.join(" | ")}`);
  }
} finally {
  await browser.close();
  if (!process.env.KEEP) {
    const users = created.users.join(",") || "00000000-0000-0000-0000-000000000000";
    const { data: studs } = await admin.from("students").select("id").or(`user_id.in.(${users}),created_by.in.(${users})`);
    const studentIds = (studs ?? []).map((s) => s.id);
    const { data: invs } = await admin.from("invoices").select("id").in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
    for (const i of invs ?? []) {
      const { data: files } = await admin.storage.from("payment-proofs").list(i.id);
      if (files?.length) await admin.storage.from("payment-proofs").remove(files.map((f) => `${i.id}/${f.name}`));
    }
    // Notifikasi ke admin asli (misalnya bukti bayar baru) ikut dihapus lewat entitasnya.
    await admin.from("notifications").delete().in("entity_id", [...(invs ?? []).map((i) => i.id), ...created.batches]);
    await admin.from("placement_attempts").delete().in("student_id", studentIds);
    await admin.from("students").delete().in("id", studentIds);
    await admin.from("batches").delete().in("id", created.batches);
    if (originalPayment) await admin.from("site_settings").update({ value: originalPayment.value, updated_by: null }).eq("key", "payment");
    else await admin.from("site_settings").delete().eq("key", "payment");
    await admin.from("audit_log").delete().in("actor_id", created.users);
    for (const id of new Set(created.users)) await admin.auth.admin.deleteUser(id);
    // Setelah akun dihapus, karena penghapusan akun ikut menulis audit (role dicabut).
    await admin.from("audit_log").delete().in("entity_id", [...created.users, ...created.batches]);
    console.log("Data uji dibersihkan, rekening dikembalikan seperti semula.");
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
  process.exit(failed.length ? 1 : 0);
}
