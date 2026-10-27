// Uji ujung-ke-ujung Fase 5: dashboard Owner, staf dan role (tambah, password awal, nonaktif), program dan harga,
// keuangan (pengeluaran + nota, CSV), backup ZIP, audit log, CMS website oleh Admin (teks, gambar, FAQ, template
// notifikasi), tiket bantuan, survei tutor oleh siswa, dan Kualitas Tutor (observasi) oleh Academic Lead.
// Membuat akun uji (@milestone.test), menjalankan alur lewat browser headless, lalu menghapus data uji dan
// mengembalikan harga program, konten website, dan catatan backup persis seperti sebelum uji.
// Jalankan: npm run e2e:fase5   (server dev harus hidup di E2E_BASE, default http://localhost:3100). KEEP=1 untuk menyimpan data uji.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = new URL("../../e2e-output/fase5/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const STARTED = new Date().toISOString();
const created = { users: [], batches: [], expenses: [], faqs: [], receipts: [] };
const results = [];
const NONE = "00000000-0000-0000-0000-000000000000";
const DAY = 86400000;
// PNG 1x1 untuk unggahan nota dan gambar.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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
  return { id: data.user.id, email: email(who), password: pw, name: meta.full_name };
}

async function shot(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)), fullPage: true });
}

const PORTAL = /\/(portal\/(student|guardian|tutor|lead|admin|owner)|password-baru)/;

async function tryLogin(page, user, pw = user.password, timeout = 30000) {
  await page.goto(`${BASE}/masuk`);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByPlaceholder("Password").fill(pw);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  return page.waitForURL(PORTAL, { timeout }).then(() => true, () => false);
}

// Supabase Auth kadang memutus koneksi sesaat; login diulang dari awal (maksimal 3 kali).
async function login(page, user, pw) {
  for (let attempt = 1; attempt <= 3; attempt++) if (await tryLogin(page, user, pw)) return;
  throw new Error(`Login ${user.email} gagal 3 kali`);
}

async function open(page, path) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Menunggu terlalu lama: ${label}`);
}

const browser = await chromium.launch();
const pages = [];
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`  [console] ${m.text().slice(0, 300)}`));
  pages.push(page);
  return page;
};

// Salinan data yang diubah uji, untuk dikembalikan persis setelahnya.
const SETTING_KEYS = ["hero", "landing", "images", "notification_templates", "backup"];
const { data: settingsBefore } = await admin.from("site_settings").select("key, value, updated_by").in("key", SETTING_KEYS);
const { data: suBefore } = await admin.from("programs").select("id, name, price_idr").eq("slug", "speakup").single();
const { data: ezProgram } = await admin.from("programs").select("id").eq("slug", "english-zero").single();

try {
  const owner = await makeUser("owner", { full_name: "Owner Uji" }, ["owner"]);
  const adm = await makeUser("admin", { full_name: "Admin Uji" }, ["admin"]);
  const lead = await makeUser("lead", { full_name: "Lead Uji" }, ["lead"]);
  const tutor = await makeUser("tutor", { full_name: "Tutor Uji" }, ["tutor"]);
  const spare = await makeUser("cadangan", { full_name: "Tutor Cadangan" }, ["tutor"]);
  const student = await makeUser("siswa", { full_name: "Siswa Uji", learning_goal: "percakapan" });
  const { data: sRow } = await admin.from("students").select("id").eq("user_id", student.id).single();

  // Batch selesai milik tutor uji (untuk survei dan kualitas tutor); tutor masih memegang batch berjalan lain.
  const batchRow = (code, status) => ({ code, program_id: ezProgram.id, tutor_id: tutor.id, start_date: new Date(Date.now() - 10 * DAY).toISOString().slice(0, 10), schedule_label: "Senin 19.00 WIB", capacity: 6, status });
  const { data: done } = await admin.from("batches").insert(batchRow(`E2E5-${RUN}`.toUpperCase().slice(0, 24), "completed")).select("id").single();
  const { data: live } = await admin.from("batches").insert(batchRow(`E2E5L-${RUN}`.toUpperCase().slice(0, 24), "running")).select("id").single();
  created.batches.push(done.id, live.id);
  const sessions = [1, 2].map((seq) => ({ batch_id: done.id, seq, starts_at: new Date(Date.now() - (6 - seq * 2) * DAY).toISOString(), duration_minutes: 60, attendance_done_at: new Date(Date.now() - (6 - seq * 2) * DAY + 2 * 3600000).toISOString() }));
  await admin.from("class_sessions").insert(sessions);
  await admin.from("class_sessions").insert({ batch_id: live.id, seq: 1, starts_at: new Date(Date.now() + 2 * DAY).toISOString(), duration_minutes: 60 });
  await admin.from("enrollments").insert({ student_id: sRow.id, batch_id: done.id, status: "completed", activated_at: new Date(Date.now() - 9 * DAY).toISOString(), onboarded_at: new Date().toISOString() });
  await admin.from("students").update({ status: "active" }).eq("id", sRow.id);

  // ---------------------------------------------------------------- Owner: dashboard
  const op = await newPage();
  await login(op, owner);
  await open(op, "/portal/owner");
  check(
    "Dashboard Owner menampilkan siswa aktif, pendapatan, konversi, dan arus kas",
    (await op.getByText("Siswa aktif", { exact: true }).count()) === 1 && (await op.getByText("Konversi pendaftar").count()) === 1 && (await op.getByText("Pemasukan & pengeluaran 6 bulan").count()) === 1,
  );
  await shot(op, "01-owner-dashboard");

  // ---------------------------------------------------------------- Owner: staf dan role
  await open(op, "/portal/owner/staf");
  const newStaff = { email: email("lead-baru"), password: password() };
  const createPanel = op.locator("section", { has: op.getByRole("heading", { name: "Tambah staf" }) }).last();
  await createPanel.getByLabel("Nama lengkap").fill("Lead Baru Uji");
  await createPanel.getByLabel("Email login").fill(newStaff.email);
  await createPanel.getByLabel("Password awal").fill(newStaff.password);
  await createPanel.getByRole("checkbox", { name: /Academic Lead/ }).check();
  await createPanel.getByRole("button", { name: "Tambah staf" }).click();
  await op.getByText(`Akun ${newStaff.email} dibuat`).waitFor({ timeout: 30000 });
  const { data: newProfile } = await admin.from("profiles").select("id, must_change_password").eq("email", newStaff.email).single();
  created.users.push(newProfile.id);
  const { data: newRoles } = await admin.from("user_roles").select("role").eq("user_id", newProfile.id);
  check("Owner menambah staf dengan password awal dan role", newProfile.must_change_password && newRoles.map((r) => r.role).join() === "lead", `wajib ganti: ${newProfile.must_change_password}, role: ${newRoles.map((r) => r.role).join()}`);
  const np = await newPage();
  await login(np, newStaff);
  check("Staf baru wajib mengganti password saat pertama masuk", np.url().includes("/password-baru"));

  await open(op, "/portal/owner/staf");
  const tutorRow = op.locator("details", { has: op.locator("summary", { hasText: tutor.email }) });
  await tutorRow.locator("summary").click();
  check("Tutor yang masih memegang batch tidak bisa dinonaktifkan", await tutorRow.getByRole("button", { name: "Nonaktifkan staf" }).isDisabled());
  const spareRow = op.locator("details", { has: op.locator("summary", { hasText: spare.email }) });
  await spareRow.locator("summary").click();
  await spareRow.getByRole("button", { name: "Nonaktifkan staf" }).click();
  await spareRow.getByRole("button", { name: "Ya, nonaktifkan" }).click();
  await until(async () => (await admin.from("profiles").select("status").eq("id", spare.id).maybeSingle()).data?.status === "inactive", "staf nonaktif");
  const xp = await newPage();
  const spareIn = await tryLogin(xp, spare, spare.password, 15000);
  check("Staf nonaktif tidak bisa masuk", !spareIn);
  await shot(op, "02-owner-staf");

  // ---------------------------------------------------------------- Owner: program dan harga
  await open(op, "/portal/owner/program");
  const suRow = op.locator("details", { has: op.locator("summary", { hasText: suBefore.name }) });
  await suRow.locator("summary").click();
  await suRow.getByLabel("Harga (Rp)").fill(String(suBefore.price_idr + 1000));
  check("Form harga mengingatkan bahwa harga baru hanya untuk invoice baru", (await suRow.getByText(/Harga baru berlaku untuk invoice yang dibuat setelah disimpan/).count()) === 1);
  await suRow.getByRole("button", { name: "Simpan program" }).click();
  await suRow.getByText("Tersimpan").waitFor({ timeout: 20000 });
  const { data: suAfter } = await admin.from("programs").select("price_idr").eq("id", suBefore.id).single();
  const { data: priceLog } = await admin.from("audit_log").select("actor_id, detail").eq("entity_id", suBefore.id).eq("action", "program_updated").order("id", { ascending: false }).limit(1).single();
  check("Owner mengubah harga program dan perubahan tercatat di audit", suAfter.price_idr === suBefore.price_idr + 1000 && priceLog.actor_id === owner.id && priceLog.detail.price_from === suBefore.price_idr);

  // ---------------------------------------------------------------- Owner: keuangan
  await open(op, "/portal/owner/keuangan");
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  await op.getByLabel("Kategori").first().selectOption("marketing");
  await op.getByLabel("Nominal (Rp)").first().fill("125000");
  await op.getByLabel("Keterangan").first().fill(`Iklan uji ${RUN}`);
  await op.getByLabel("Foto nota (opsional)").first().setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
  await op.getByRole("button", { name: "Catat pengeluaran" }).click();
  const expense = await until(async () => (await admin.from("expenses").select("id, receipt_path, amount_idr, spent_on").eq("description", `Iklan uji ${RUN}`).maybeSingle()).data, "pengeluaran tersimpan");
  created.expenses.push(expense.id);
  if (expense.receipt_path) created.receipts.push(expense.receipt_path);
  check("Owner mencatat pengeluaran beserta foto nota", expense.amount_idr === 125000 && Boolean(expense.receipt_path) && expense.spent_on === today);
  await op.reload();
  await op.waitForLoadState("networkidle");
  check("Pengeluaran tampil di daftar bulan ini", (await op.getByText(`Iklan uji ${RUN}`).count()) >= 1);
  const month = today.slice(0, 7);
  const csv = await op.request.get(`${BASE}/api/owner/keuangan?dari=${month}&sampai=${month}`);
  const csvText = await csv.text();
  check("Ekspor CSV keuangan berisi pengeluaran", csv.ok() && csvText.includes("tanggal,jenis,kategori,keterangan,nominal") && csvText.includes(`Iklan uji ${RUN}`) && csvText.includes("-125000"));
  await shot(op, "03-owner-keuangan");

  // ---------------------------------------------------------------- Owner: backup dan audit log
  const backup = await op.request.get(`${BASE}/api/owner/backup`);
  const zip = Buffer.from(await backup.body());
  check("Backup ZIP berisi CSV semua tabel", backup.ok() && zip.subarray(0, 2).toString() === "PK" && zip.includes(Buffer.from("profiles.csv")) && zip.includes(Buffer.from("expenses.csv")), `${zip.length} byte`);
  const { data: backupSetting } = await admin.from("site_settings").select("value").eq("key", "backup").single();
  check("Waktu backup terakhir tercatat", Date.parse(backupSetting.value.last_at) > Date.parse(STARTED));
  await open(op, "/portal/owner/audit");
  check("Audit log menampilkan aksi Owner", (await op.getByText("Menambah staf").count()) >= 1 && (await op.getByText("Mengunduh backup").count()) >= 1);
  await shot(op, "04-owner-audit");

  // ---------------------------------------------------------------- Admin: CMS website
  const ap = await newPage();
  await login(ap, adm);
  await open(ap, "/portal/admin/cms?tab=teks");
  const badge = `Uji badge ${RUN}`;
  await ap.getByLabel("Label kecil di atas judul").fill(badge);
  await ap.getByRole("button", { name: "Simpan bagian hero" }).click();
  await ap.getByText("Tersimpan dan tampil di website").first().waitFor({ timeout: 20000 });
  await ap.getByLabel("Angka 1", { exact: true }).fill("15");
  await ap.getByLabel("Keterangan 1", { exact: true }).fill(`Program uji ${RUN}`);
  await ap.getByRole("button", { name: "Simpan teks landing page" }).click();
  await until(async () => (await admin.from("site_settings").select("value").eq("key", "landing").maybeSingle()).data?.value?.stats?.[0]?.label === `Program uji ${RUN}`, "teks landing tersimpan");
  const lp = await newPage();
  await open(lp, "/");
  check("Teks hero dan angka kunci yang diubah Admin tampil di website", (await lp.getByText(badge).count()) === 1 && (await lp.getByText(`Program uji ${RUN}`).count()) === 1);

  await open(ap, "/portal/admin/cms?tab=gambar");
  await ap.getByLabel("Ganti Latar hero (paling atas)").setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: PNG });
  await until(async () => (await admin.from("site_settings").select("value").eq("key", "images").maybeSingle()).data?.value?.hero, "gambar hero tersimpan");
  await open(lp, "/");
  const heroStyle = await lp.locator("header#hero").getAttribute("style");
  check("Gambar hero unggahan dipakai di website", Boolean(heroStyle?.includes("site-images")));
  await ap.reload();
  await ap.getByRole("button", { name: "Pakai gambar bawaan" }).click();
  await until(async () => (await admin.from("site_settings").select("value").eq("key", "images").maybeSingle()).data?.value?.hero === "", "gambar bawaan");

  await open(ap, "/portal/admin/cms?tab=faq");
  const question = `Pertanyaan uji ${RUN}?`;
  await ap.getByLabel("Pertanyaan").first().fill(question);
  await ap.getByLabel("Jawaban").first().fill("Jawaban uji untuk memastikan FAQ tampil.");
  await ap.getByRole("button", { name: "Tambah FAQ" }).click();
  const faq = await until(async () => (await admin.from("faqs").select("id").eq("question", question).maybeSingle()).data, "FAQ tersimpan");
  created.faqs.push(faq.id);
  await open(lp, "/");
  check("FAQ baru dari Admin tampil di website", (await lp.getByText(question).count()) === 1);

  await open(ap, "/portal/admin/cms?tab=notifikasi");
  const tplRow = ap.locator("details", { has: ap.locator("summary", { hasText: "Tiket dibalas" }) });
  await tplRow.locator("summary").click();
  await tplRow.getByLabel("Judul (subjek email)").fill(`Balasan tiket {number} (uji ${RUN})`);
  await tplRow.getByRole("button", { name: "Simpan template" }).click();
  await tplRow.getByText(/Tersimpan/).waitFor({ timeout: 20000 });
  await shot(ap, "05-admin-cms-template");

  await open(ap, "/portal/owner");
  check("Admin tidak bisa membuka menu Owner", !ap.url().includes("/portal/owner"));

  // ---------------------------------------------------------------- Bantuan: siswa membuat tiket, Admin membalas dan menutup
  const sp = await newPage();
  await login(sp, student);
  await open(sp, "/portal/student/bantuan");
  const subject = `Kendala uji ${RUN}`;
  await sp.getByLabel("Kategori").selectOption("payment");
  await sp.getByLabel("Judul singkat").fill(subject);
  await sp.getByLabel("Ceritakan kendalanya").fill("Bukti transfer sudah saya unggah tapi belum diverifikasi.");
  await sp.getByRole("button", { name: "Kirim tiket" }).click();
  await sp.waitForURL(/bantuan\?id=/, { timeout: 20000 });
  const ticketId = new URL(sp.url()).searchParams.get("id");
  const { data: ticket } = await admin.from("tickets").select("number, status").eq("id", ticketId).single();
  check("Siswa membuat tiket bantuan", ticket.status === "open" && /^TKT-\d{5}$/.test(ticket.number), ticket.number);

  await open(ap, "/portal/admin");
  check("Beranda Admin menghitung tiket yang perlu dibalas", (await ap.locator("a", { hasText: "Tiket bantuan perlu dibalas" }).count()) === 1);
  await open(ap, "/portal/admin/bantuan");
  await ap.getByRole("link", { name: new RegExp(subject) }).click();
  await ap.waitForURL(/bantuan\?id=/, { timeout: 20000 });
  await ap.getByLabel("Balasan untuk pengirim").fill("Sudah kami cek, pembayaranmu terverifikasi hari ini.");
  await ap.getByRole("button", { name: "Kirim balasan" }).click();
  await until(async () => (await admin.from("tickets").select("status").eq("id", ticketId).single()).data.status === "answered", "tiket dibalas");
  const { data: replyNote } = await until(async () => {
    const r = await admin.from("notifications").select("subject").eq("template", "ticket_replied").eq("recipient_id", student.id).limit(1);
    return r.data?.length ? r : null;
  }, "notifikasi balasan");
  check("Notifikasi balasan tiket memakai template yang diubah Admin", replyNote[0].subject === `Balasan tiket ${ticket.number} (uji ${RUN})`, replyNote[0].subject);
  await sp.reload();
  check("Siswa membaca balasan Admin", (await sp.getByText("Sudah kami cek, pembayaranmu terverifikasi hari ini.").count()) === 1);
  await ap.reload();
  await ap.getByRole("button", { name: "Tutup tiket" }).click();
  await ap.getByRole("button", { name: "Ya, tutup tiket" }).click();
  await until(async () => (await admin.from("tickets").select("status").eq("id", ticketId).single()).data.status === "closed", "tiket ditutup");
  await sp.reload();
  await sp.getByLabel("Masih ada kendala? Buka lagi tiket ini").fill("Ternyata kelas belum muncul di portal.");
  await sp.getByRole("button", { name: "Buka lagi tiket" }).click();
  await until(async () => (await admin.from("tickets").select("status").eq("id", ticketId).single()).data.status === "open", "tiket dibuka lagi");
  check("Admin menutup tiket dan siswa membukanya lagi", true);
  await shot(sp, "06-siswa-tiket");

  // ---------------------------------------------------------------- Survei tutor oleh siswa
  await open(sp, "/portal/student/laporan");
  const survey = sp.locator("section", { has: sp.getByRole("heading", { name: "Nilai tutor kelasmu" }) }).last();
  await survey.getByText("Luar biasa").click();
  await survey.getByLabel(/Komentar/).fill(`Tutornya sabar (uji ${RUN})`);
  await survey.getByRole("button", { name: "Kirim penilaian" }).click();
  const surveyRow = await until(async () => (await admin.from("tutor_surveys").select("rating, tutor_id").eq("batch_id", done.id).maybeSingle()).data, "survei tersimpan");
  check("Siswa menilai tutor setelah program selesai", surveyRow.rating === 5 && surveyRow.tutor_id === tutor.id);
  await sp.reload();
  check("Ajakan menilai hilang setelah dikirim", (await sp.getByText("Nilai tutor kelasmu").count()) === 0);

  // ---------------------------------------------------------------- Academic Lead: kualitas tutor dan observasi
  const lq = await newPage();
  await login(lq, lead);
  await open(lq, "/portal/lead/kualitas-tutor");
  const row = lq.locator("tr", { hasText: "Tutor Uji" });
  const rowText = (await row.innerText()).replace(/\s+/g, " ");
  check("Kualitas Tutor menampilkan rekap survei dan ketepatan absensi", rowText.includes("5,0 / 5 (1)") && rowText.includes("100%"), rowText);
  await row.getByRole("link", { name: "Tutor Uji" }).click();
  await lq.waitForURL(/kualitas-tutor\?id=/, { timeout: 20000 });
  check("Detail tutor menampilkan komentar survei tanpa nama siswa", (await lq.getByText(`Tutornya sabar (uji ${RUN})`).count()) === 1 && (await lq.getByText("Siswa Uji").count()) === 0);
  for (const aspect of ["Persiapan & materi", "Keterlibatan siswa", "Kejelasan penjelasan", "Koreksi & feedback", "Manajemen waktu"]) {
    await lq.getByRole("radiogroup", { name: aspect }).getByText("Sangat baik").click();
  }
  await lq.getByLabel("Kekuatan tutor").fill("Persiapan materi rapi dan siswa aktif berbicara.");
  await lq.getByLabel("Saran perbaikan").fill("Beri koreksi pengucapan lebih cepat.");
  await lq.getByRole("button", { name: "Simpan observasi" }).click();
  await lq.getByText("Observasi tersimpan").waitFor({ timeout: 20000 });
  const { data: obs } = await admin.from("tutor_observations").select("scores, observed_by").eq("tutor_id", tutor.id);
  check("Academic Lead mencatat observasi kelas", obs.length === 1 && obs[0].scores.time === 4 && obs[0].observed_by === lead.id);
  await lq.reload();
  check("Riwayat observasi tampil di detail tutor", (await lq.getByText("Riwayat observasi (1)").count()) === 1);
  await shot(lq, "07-lead-kualitas-tutor");

  const tp = await newPage();
  await login(tp, tutor);
  await open(tp, "/portal/lead/kualitas-tutor");
  check("Tutor tidak bisa membuka Kualitas Tutor", !tp.url().includes("/portal/lead"));
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
    const users = created.users.length ? created.users : [NONE];
    const batches = created.batches.length ? created.batches : [NONE];
    const { data: studs } = await admin.from("students").select("id").or(`user_id.in.(${users.join(",")}),created_by.in.(${users.join(",")})`);
    const { data: tickets } = await admin.from("tickets").select("id").in("requester_id", users);
    const entityIds = [...batches, ...(tickets ?? []).map((t) => t.id), ...created.users, ...created.expenses];
    if (created.receipts.length) await admin.storage.from("expense-receipts").remove(created.receipts);
    const { data: images } = await admin.storage.from("site-images").list("landing", { limit: 1000 });
    const testImages = (images ?? []).filter((f) => Date.parse(f.created_at) >= Date.parse(STARTED)).map((f) => `landing/${f.name}`);
    if (testImages.length) await admin.storage.from("site-images").remove(testImages);
    await admin.from("notifications").delete().in("entity_id", entityIds);
    await admin.from("notifications").delete().in("recipient_id", users);
    await admin.from("expenses").delete().in("id", created.expenses.length ? created.expenses : [NONE]);
    await admin.from("faqs").delete().in("id", created.faqs.length ? created.faqs : [NONE]);
    await admin.from("students").delete().in("id", (studs ?? []).map((s) => s.id).concat(NONE));
    await admin.from("batches").delete().in("id", batches);

    // Harga program dan konten website dikembalikan seperti sebelum uji.
    await admin.from("programs").update({ price_idr: suBefore.price_idr }).eq("id", suBefore.id);
    for (const key of SETTING_KEYS) {
      const before = (settingsBefore ?? []).find((s) => s.key === key);
      if (before) await admin.from("site_settings").update({ value: before.value, updated_by: before.updated_by }).eq("key", key);
      else await admin.from("site_settings").delete().eq("key", key);
    }
    await admin.from("user_roles").update({ granted_by: null }).in("granted_by", users);
    await admin.from("audit_log").delete().in("actor_id", users);
    await admin.from("audit_log").delete().in("entity_id", [...entityIds, suBefore.id, ...SETTING_KEYS]).gte("created_at", STARTED);
    for (const id of new Set(created.users)) await admin.auth.admin.deleteUser(id);
    console.log("Data uji dibersihkan; harga program, konten website, dan catatan backup dikembalikan seperti semula.");
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
  process.exit(failed.length ? 1 : 0);
}
