// Uji ujung-ke-ujung Fase 3: kurikulum berversi, batch berkurikulum, absensi, tugas, revisi, feedback,
// pengingat H-1, dan mode baca saja setelah program selesai.
// Membuat akun uji (@milestone.test), menjalankan alur lewat browser headless, lalu menghapus data uji dan
// mengembalikan kurikulum English Zero persis seperti sebelum uji.
// Jalankan: npm run e2e:fase3   (server dev harus hidup di E2E_BASE, default http://localhost:3100)
// E2E_CRON_SECRET = CRON_SECRET server dev, untuk menguji pengingat H-1. KEEP=1 untuk menyimpan data uji.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = new URL("../../e2e-output/fase3/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const created = { users: [], batches: [] };
const results = [];
const NONE = "00000000-0000-0000-0000-000000000000";

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

async function login(page, user) {
  await page.goto(`${BASE}/masuk`);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(/\/portal\/(student|guardian|tutor|lead|admin|owner)/, { timeout: 30000 });
}

async function open(page, path) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
}

async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Menunggu terlalu lama: ${label}`);
}

// <details> dibuka hanya bila sedang tertutup (render ulang mempertahankan keadaannya).
async function openDetails(loc) {
  if (!(await loc.evaluate((d) => d.open))) await loc.locator("summary").click();
}

function dateInDays(n) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + n * 86400000));
}

const { data: programs } = await admin.from("programs").select("id, slug, name, duration_label").eq("status", "active");
const ezProgram = programs.find((p) => p.slug === "english-zero");

// Salinan kurikulum English Zero sebelum uji, untuk dikembalikan persis setelahnya.
const { data: curBefore } = await admin.from("curricula").select("*").eq("program_id", ezProgram.id);
const curIds = (curBefore ?? []).map((c) => c.id);
const { data: modBefore } = await admin.from("curriculum_modules").select("*").in("curriculum_id", curIds.length ? curIds : [NONE]);
const modIds = (modBefore ?? []).map((m) => m.id);
const { data: matBefore } = await admin.from("module_materials").select("id").in("module_id", modIds.length ? modIds : [NONE]);
const { data: taskBefore } = await admin.from("module_tasks").select("*").in("module_id", modIds.length ? modIds : [NONE]);
// Uji memakai versi terbaru; bila masih draf, uji juga menerbitkannya (dikembalikan setelah uji).
const ezCur = [...(curBefore ?? [])].sort((a, b) => b.version - a.version)[0];
const wasDraft = ezCur?.status === "draft";
const ezModules = (modBefore ?? []).filter((m) => m.curriculum_id === ezCur?.id);

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const WEBM = Buffer.from("1a45dfa3010000000000001f4286810142f7810142f2810442f381084282847765626d42878102428581021853806701", "hex");

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const pages = [];
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone"] });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`  [console] ${m.text().slice(0, 300)}`));
  pages.push(page);
  return page;
};

try {
  if (!ezCur) throw new Error("Kurikulum English Zero tidak ditemukan (jalankan npm run db:migrate).");
  const lead = await makeUser("lead", { full_name: "Lead Uji" }, ["lead"]);
  const adm = await makeUser("admin", { full_name: "Admin Uji" }, ["admin"]);
  const tutor = await makeUser("tutor", { full_name: "Tutor Uji" }, ["tutor"]);
  const tutor2 = await makeUser("tutor2", { full_name: "Tutor Lain" }, ["tutor"]);
  const student = await makeUser("siswa", { full_name: "Siswa Uji", learning_goal: "percakapan" });
  const other = await makeUser("lain", { full_name: "Siswa Lain" });
  const guardian = await makeUser("wali", { account_type: "guardian", full_name: "Wali Uji", child_name: "Anak Uji", child_birth_year: "2016" });
  const { data: sRow } = await admin.from("students").select("id").eq("user_id", student.id).single();
  const { data: link } = await admin.from("guardian_links").select("id, student_id").eq("guardian_id", guardian.id).single();
  await admin.from("guardian_links").update({ status: "verified" }).eq("id", link.id);
  const childId = link.student_id;

  // ---------------------------------------------------------------- Academic Lead: tinjau, lengkapi, terbitkan
  const lp = await newPage();
  await login(lp, lead);
  check("Beranda Academic Lead menampilkan kurikulum yang masih draf", (await lp.locator("a", { hasText: "Kurikulum masih draf" }).count()) === 1);
  await open(lp, "/portal/lead/kurikulum");
  const programRows = await lp.locator("tbody tr").count();
  check("Daftar kurikulum memuat 12 program, masing-masing dengan kurikulum", programRows === 12 && (await lp.getByText("Versi 1").count()) === 12, `${programRows} program`);
  await shot(lp, "01-lead-daftar");

  await open(lp, `/portal/lead/kurikulum?id=${ezCur.id}`);
  const ezDetails = await lp.locator("main details").count();
  const ezWeeks = await lp.getByRole("heading", { name: /^Minggu \d$/ }).count();
  check("Kurikulum English Zero berisi 8 sesi dalam 4 minggu", ezModules.length === 8 && ezDetails === 8 && ezWeeks === 4, `${ezModules.length} modul, ${ezDetails} sesi tampil, ${ezWeeks} minggu`);
  const first = lp.locator("main details").filter({ has: lp.locator("summary", { hasText: "Hello! Greetings" }) });
  await openDetails(first);
  const content = first.getByLabel("Isi materi");
  await content.fill(`${await content.inputValue()}\n• Catatan uji E2E-${RUN}`);
  await first.getByRole("button", { name: "Simpan sesi" }).click();
  await first.getByText("Tersimpan").first().waitFor({ timeout: 20000 });
  check("Lead mengubah isi sesi 1", true);
  await first.getByLabel("Judul materi").fill("Video sapaan uji");
  await first.getByLabel("Link materi").fill("https://youtu.be/e2e-milestone");
  await first.getByRole("button", { name: "+ Tambah materi" }).click();
  await first.getByText("Video sapaan uji").waitFor({ timeout: 20000 });
  await first.getByRole("button", { name: "File atau audio" }).click();
  await first.getByLabel("Judul materi").fill("Lembar kosakata uji");
  await first.getByLabel("File materi").setInputFiles({ name: "kosakata.pdf", mimeType: "application/pdf", buffer: PDF });
  await first.getByRole("button", { name: "+ Tambah materi" }).click();
  await first.getByText("Lembar kosakata uji").waitFor({ timeout: 30000 });
  check("Lead menambah materi link dan file PDF", true);
  await shot(lp, "02-lead-editor");

  if (wasDraft) {
    await lp.getByRole("button", { name: "Terbitkan kurikulum" }).click();
    await lp.getByRole("button", { name: "Ya, terbitkan" }).click();
    await lp.getByRole("button", { name: "Buat versi baru" }).waitFor({ timeout: 20000 });
  }
  const { data: pub } = await admin.from("curricula").select("status").eq("id", ezCur.id).single();
  check(wasDraft ? "Lead menerbitkan kurikulum English Zero" : "Kurikulum English Zero sudah terbit sebelumnya", pub.status === "published");
  const firstAfter = lp.locator("main details").filter({ has: lp.locator("summary", { hasText: "Hello! Greetings" }) });
  await openDetails(firstAfter);
  check("Versi terbit: minggu terkunci, isi tetap bisa diubah", await firstAfter.getByLabel("Minggu ke").isDisabled());
  await firstAfter.getByLabel("Tujuan sesi").fill(`${ezModules.find((m) => m.seq === 1).objectives} (diperbarui)`);
  await firstAfter.getByRole("button", { name: "Simpan sesi" }).click();
  await firstAfter.getByText("Tersimpan").first().waitFor({ timeout: 20000 });

  await lp.getByRole("button", { name: "Buat versi baru" }).click();
  await lp.waitForURL((u) => u.searchParams.get("id") && u.searchParams.get("id") !== ezCur.id, { timeout: 20000 });
  await lp.waitForLoadState("networkidle");
  const v2Details = await lp.locator("main details").count();
  const v2Label = await lp.getByText(`Versi ${ezCur.version + 1} · Draf`).count();
  check("Versi baru adalah salinan lengkap (8 sesi, berstatus draf)", v2Details === 8 && v2Label === 1, `${v2Details} sesi, label ${v2Label}`);
  await shot(lp, "02b-lead-versi-baru");
  await lp.getByLabel("Judul sesi baru").fill("Sesi bonus uji");
  await lp.getByRole("button", { name: "+ Tambah sesi" }).click();
  await until(async () => (await lp.locator("main details").count()) === 9, "sesi bonus");
  check("Struktur draf versi baru bisa diubah (tambah sesi)", true);
  await shot(lp, "02c-lead-sesi-bonus");
  await lp.getByRole("button", { name: "Hapus draf" }).click();
  await lp.getByRole("button", { name: "Ya, hapus draf" }).click();
  await lp.waitForURL((u) => !u.searchParams.get("id"), { timeout: 20000 });
  const { count: ezVersions } = await admin.from("curricula").select("id", { count: "exact", head: true }).eq("program_id", ezProgram.id);
  check("Draf versi baru bisa dihapus tanpa menyentuh versi terbit", ezVersions === curIds.length);

  // ---------------------------------------------------------------- Admin: batch memakai kurikulum
  const ap = await newPage();
  await login(ap, adm);
  await open(ap, "/portal/admin/batch?baru=1");
  await ap.locator("select").first().selectOption({ label: `${ezProgram.name} · ${ezProgram.duration_label}` });
  const curSelect = ap.locator("label", { hasText: /^Kurikulum/ }).locator("select");
  const curLabel = await curSelect.locator("option:checked").innerText();
  check("Form batch otomatis memilih kurikulum terbit, jumlah sesi terkunci", curLabel.includes(`Versi ${ezCur.version}`) && (await ap.locator("label", { hasText: /^Jumlah sesi/ }).locator("input").isDisabled()), curLabel);
  await ap.locator("input[type=date]").fill(dateInDays(7));
  await ap.getByRole("button", { name: "Selasa", exact: true }).click();
  await ap.getByRole("button", { name: "Kamis", exact: true }).click();
  await ap.locator("label", { hasText: /^Tutor/ }).locator("select").selectOption({ label: "Tutor Uji" });
  await ap.getByPlaceholder("https://meet.google.com/...").fill("https://meet.google.com/uji-fase3");
  await ap.getByRole("button", { name: "Buat batch dan jadwal sesi" }).click();
  await ap.waitForURL(/\/portal\/admin\/batch\?id=/, { timeout: 30000 });
  const batchId = new URL(ap.url()).searchParams.get("id");
  created.batches.push(batchId);
  const { data: sessions } = await admin.from("class_sessions").select("id, seq, module_id, topic").eq("batch_id", batchId).order("seq");
  check("Batch berkurikulum: 8 sesi, tiap sesi menunjuk modulnya", sessions.length === 8 && sessions.every((s) => s.module_id && s.topic), sessions[0]?.topic);
  await shot(ap, "03-admin-batch");

  // Siswa dan anak langsung aktif (alur bayar sudah diuji di Fase 2); sesi 1 dimulai 2 jam lalu.
  for (const sid of [sRow.id, childId]) {
    await admin.from("enrollments").insert({ student_id: sid, batch_id: batchId, status: "active", activated_at: new Date().toISOString(), onboarded_at: new Date().toISOString() });
    await admin.from("students").update({ status: "active" }).eq("id", sid);
  }
  for (const s of sessions) {
    const at = s.seq === 1 ? Date.now() - 2 * 3600000 : Date.now() + (s.seq - 1) * 2 * 86400000;
    await admin.from("class_sessions").update({ starts_at: new Date(at).toISOString() }).eq("id", s.id);
  }
  const s1 = sessions[0].id;

  // ---------------------------------------------------------------- Tutor: absensi dan terbitkan tugas
  const tp = await newPage();
  await login(tp, tutor);
  const pendingCard = await tp.locator("a", { hasText: "Absensi belum diisi" }).innerText();
  check("Beranda tutor: 1 absensi belum diisi", /^\s*1\b/.test(pendingCard), pendingCard.split("\n")[0]);
  await open(tp, `/portal/tutor/sesi?id=${s1}`);
  const marker = await tp.getByText(`Catatan uji E2E-${RUN}`).count();
  const linkMat = await tp.getByText("Video sapaan uji").count();
  const fileMat = await tp.getByText("Lembar kosakata uji").count();
  check("Halaman sesi menampilkan modul, isi terbaru, dan materi", marker === 1 && linkMat === 1 && fileMat === 1, `isi ${marker}, link ${linkMat}, file ${fileMat}`);
  await tp.getByRole("radiogroup", { name: "Kehadiran Anak Uji" }).getByRole("radio", { name: "Tidak hadir" }).click();
  await tp.getByLabel("Catatan Anak Uji").fill("Tanpa kabar");
  await tp.getByRole("button", { name: "Simpan absensi" }).click();
  await tp.getByText("Tersimpan").first().waitFor({ timeout: 20000 });
  const { data: att } = await admin.from("attendance").select("student_id, status").eq("session_id", s1);
  check("Tutor mengisi absensi (siswa hadir, anak tidak hadir)", att.find((a) => a.student_id === sRow.id)?.status === "present" && att.find((a) => a.student_id === childId)?.status === "absent");
  await shot(tp, "04-tutor-sesi");

  await tp.locator("div.rounded-xl", { hasText: "Rekam perkenalan pertamamu" }).getByRole("button", { name: "Terbitkan tugas ini" }).click();
  await tp.getByRole("button", { name: "Terbitkan ke siswa" }).click();
  await tp.getByRole("link", { name: "Lihat pengumpulan →" }).first().waitFor({ timeout: 20000 });
  await tp.getByRole("button", { name: "+ Buat tugas lain" }).click();
  await tp.getByLabel("Judul tugas").fill("Tulis tiga kalimat perkenalan");
  await tp.getByLabel("Jenis pengumpulan").selectOption("text");
  await tp.getByLabel("Instruksi tugas").fill("Tulis tiga kalimat tentang dirimu dalam bahasa Inggris.");
  await tp.getByRole("button", { name: "Terbitkan ke siswa" }).click();
  await until(async () => (await tp.getByRole("link", { name: "Lihat pengumpulan →" }).count()) === 2, "dua tugas terbit");
  const { data: asg } = await admin.from("assignments").select("id, title, due_at, submission_type").eq("batch_id", batchId);
  const audioTask = asg.find((a) => a.submission_type === "audio");
  const textTask = asg.find((a) => a.submission_type === "text");
  const s2 = await admin.from("class_sessions").select("starts_at").eq("id", sessions[1].id).single();
  check("Tutor menerbitkan tugas dari template dan tugas tambahan", Boolean(audioTask && textTask));
  check("Tenggat default: sebelum sesi berikutnya", Math.abs(Date.parse(audioTask.due_at) - Date.parse(s2.data.starts_at)) < 60000);

  // ---------------------------------------------------------------- Siswa: jadwal, kumpul tugas
  const sp = await newPage();
  await login(sp, student);
  check("Beranda siswa: ringkasan Minggu ini dengan tugas tertunda", (await sp.locator("text=Minggu ini").count()) >= 1 && (await sp.getByRole("link", { name: "Rekam perkenalan pertamamu" }).count()) === 1);
  await shot(sp, "05-siswa-beranda");
  await open(sp, "/portal/student/jadwal");
  check("Jadwal siswa: sesi 1 tercatat Hadir", (await sp.locator("li", { hasText: "Sesi 1" }).first().getByText("Hadir", { exact: true }).count()) === 1);
  await open(sp, "/portal/student/materi");
  const textLi = sp.locator(`#tugas-${textTask.id}`);
  await textLi.getByLabel("Jawaban").fill("My name is Siswa. I live in Jakarta. I like reading.");
  await textLi.getByRole("button", { name: "Kumpulkan" }).click();
  await textLi.getByText("Menunggu feedback").first().waitFor({ timeout: 20000 });
  const audioLi = sp.locator(`#tugas-${audioTask.id}`);
  await audioLi.getByRole("button", { name: "Unggah file" }).click();
  await audioLi.getByLabel("File tugas").setInputFiles({ name: "perkenalan.webm", mimeType: "audio/webm", buffer: WEBM });
  await audioLi.getByRole("button", { name: "Kumpulkan" }).click();
  await audioLi.getByText("Menunggu feedback").first().waitFor({ timeout: 30000 });
  check("Siswa mengumpulkan tugas teks dan file rekaman", true);
  await shot(sp, "06-siswa-materi");

  // ---------------------------------------------------------------- Wali: kehadiran anak, rekam tugas untuk anak
  const gp = await newPage();
  await login(gp, guardian);
  await open(gp, `/portal/guardian/jadwal?anak=${childId}`);
  check("Wali melihat anak tercatat Tidak hadir", (await gp.locator("li", { hasText: "Sesi 1" }).first().getByText("Tidak hadir").count()) === 1);
  await open(gp, `/portal/guardian/materi?anak=${childId}`);
  const gAudio = gp.locator(`#tugas-${audioTask.id}`);
  await gAudio.getByRole("button", { name: "Mulai rekam" }).click();
  await gp.waitForTimeout(2500);
  await gAudio.getByRole("button", { name: /Berhenti/ }).click();
  await gAudio.locator("audio").waitFor({ timeout: 10000 });
  await gAudio.getByRole("button", { name: "Kumpulkan" }).click();
  await gAudio.getByText("Menunggu feedback").first().waitFor({ timeout: 30000 });
  const { data: childSub } = await admin.from("submissions").select("mime, submitted_by").eq("assignment_id", audioTask.id).eq("student_id", childId).single();
  check("Wali merekam dan mengumpulkan tugas untuk anak (tanpa akun sendiri)", childSub?.mime?.startsWith("audio/") && childSub.submitted_by === guardian.id, childSub?.mime);
  await shot(gp, "07-wali-materi");

  // ---------------------------------------------------------------- Tutor: feedback draf, minta revisi, terima
  await open(tp, "/portal/tutor/tugas");
  check("Tutor melihat 2 tugas yang perlu feedback", (await tp.locator("tbody tr").count()) === 2);
  await open(tp, `/portal/tutor/tugas?id=${textTask.id}`);
  const sPanel = tp.locator("section", { hasText: "Siswa Uji" }).first();
  await sPanel.getByLabel("Feedback").fill("Good start! Tambahkan satu kalimat tentang pekerjaan atau sekolahmu.");
  await sPanel.getByRole("radio", { name: /Minta revisi/ }).check();
  await sPanel.getByRole("button", { name: "Simpan draf" }).click();
  await sPanel.getByText("Draf tersimpan").waitFor({ timeout: 20000 });
  await open(sp, `/portal/student/materi?tugas=${textTask.id}`);
  check("Draf feedback belum terlihat siswa", (await sp.locator("text=Tambahkan satu kalimat").count()) === 0);
  await open(tp, `/portal/tutor/tugas?id=${textTask.id}`);
  const sPanel2 = tp.locator("section", { hasText: "Siswa Uji" }).first();
  await sPanel2.getByRole("button", { name: "Terbitkan feedback" }).click();
  await sPanel2.getByText("Perlu revisi").waitFor({ timeout: 20000 });

  await open(sp, `/portal/student/materi?tugas=${textTask.id}`);
  const rev = sp.locator(`#tugas-${textTask.id}`);
  check("Siswa melihat feedback dan permintaan revisi", (await rev.getByText("Perlu revisi").count()) >= 1 && (await rev.locator("text=Tambahkan satu kalimat").count()) === 1);
  await rev.getByLabel("Jawaban").fill("My name is Siswa. I live in Jakarta. I like reading. I work as a designer.");
  await rev.getByRole("button", { name: "Kirim revisi" }).click();
  await rev.getByText("Menunggu feedback").first().waitFor({ timeout: 20000 });

  await open(tp, `/portal/tutor/tugas?id=${textTask.id}`);
  const sPanel3 = tp.locator("section", { hasText: "Siswa Uji" }).first();
  await sPanel3.getByLabel("Feedback").fill("Great, sudah lengkap dan jelas.");
  await sPanel3.getByRole("button", { name: "Terbitkan feedback" }).click();
  await sPanel3.getByText("Selesai", { exact: true }).waitFor({ timeout: 20000 });
  await shot(tp, "08-tutor-feedback");
  await open(sp, `/portal/student/materi?tugas=${textTask.id}`);
  const doneLi = sp.locator(`#tugas-${textTask.id}`);
  check("Revisi diterima: tugas Selesai, riwayat versi tersimpan", (await doneLi.getByText("Selesai", { exact: true }).count()) === 1 && (await doneLi.getByText(/Revisi 1/).count()) === 1);

  // ---------------------------------------------------------------- Pengingat H-1 lewat jadwal harian
  const unauth = await fetch(`${BASE}/api/cron/daily`);
  check("Jadwal harian menolak permintaan tanpa CRON_SECRET", unauth.status === 401);
  if (process.env.E2E_CRON_SECRET) {
    await admin.from("assignments").update({ due_at: new Date(Date.now() + 12 * 3600000).toISOString(), reminder_sent_at: null }).eq("id", textTask.id);
    const res = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${process.env.E2E_CRON_SECRET}` } });
    const body = await res.json();
    const { data: rem } = await admin.from("notifications").select("recipient_id").eq("template", "assignment_reminder").eq("entity_id", textTask.id);
    check("Pengingat H-1 terkirim ke yang belum mengumpulkan (wali anak)", res.ok && body.reminders === 1 && rem?.some((r) => r.recipient_id === guardian.id), `${body.reminders} pengingat`);
  }

  // ---------------------------------------------------------------- Keamanan
  const t2 = await newPage();
  await login(t2, tutor2);
  await open(t2, `/portal/tutor/sesi?id=${s1}`);
  check("Tutor lain tidak bisa membuka sesi batch orang lain", (await t2.locator("text=bukan bagian dari kelasmu").count()) === 1);
  const xp = await newPage();
  await login(xp, other);
  await open(xp, "/portal/tutor/sesi");
  check("Siswa tidak bisa membuka portal tutor", !xp.url().includes("/portal/tutor"));
  await open(xp, "/portal/student/materi");
  check("Calon siswa tidak melihat menu materi (dialihkan ke beranda)", new URL(xp.url()).pathname === "/portal/student");

  // ---------------------------------------------------------------- Program selesai: baca saja
  for (const s of sessions) await admin.from("class_sessions").update({ starts_at: new Date(Date.now() - (10 - s.seq) * 86400000).toISOString() }).eq("id", s.id);
  await open(sp, "/portal/student/materi");
  const { data: batchAfter } = await admin.from("batches").select("status").eq("id", batchId).single();
  const { data: enrAfter } = await admin.from("enrollments").select("status").eq("batch_id", batchId).eq("student_id", sRow.id).single();
  check("Setelah sesi terakhir: batch Selesai dan siswa berstatus selesai", batchAfter.status === "completed" && enrAfter.status === "completed");
  check("Materi tampil sebagai Selesai, baca saja tanpa tombol kumpul", (await sp.getByText("Selesai, baca saja").count()) === 1 && (await sp.getByRole("button", { name: /Kumpulkan|Kirim revisi/ }).count()) === 0);
  await shot(sp, "09-siswa-baca-saja");

  // ---------------------------------------------------------------- Notifikasi tercatat
  const { data: notes } = await admin.from("notifications").select("template, status, recipient_id").in("recipient_id", created.users);
  const templates = new Set((notes ?? []).map((n) => n.template));
  const expected = ["attendance_absent", "assignment_published", "feedback_published"];
  const absentToGuardian = (notes ?? []).some((n) => n.template === "attendance_absent" && n.recipient_id === guardian.id);
  check(
    "Notifikasi Fase 3 tercatat (wali diberi kabar ketidakhadiran)",
    expected.every((t) => templates.has(t)) && absentToGuardian,
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
    const users = created.users.join(",") || NONE;
    const { data: studs } = await admin.from("students").select("id").or(`user_id.in.(${users}),created_by.in.(${users})`);
    const studentIds = (studs ?? []).map((s) => s.id);
    const { data: asgs } = await admin.from("assignments").select("id").in("batch_id", created.batches.length ? created.batches : [NONE]);
    const { data: subs } = await admin.from("submissions").select("id, file_path").in("assignment_id", (asgs ?? []).map((a) => a.id).concat(NONE));
    const subFiles = (subs ?? []).map((s) => s.file_path).filter(Boolean);
    if (subFiles.length) await admin.storage.from("assignment-files").remove(subFiles);
    const { data: sess } = await admin.from("class_sessions").select("id").in("batch_id", created.batches.length ? created.batches : [NONE]);
    const entityIds = [...created.batches, ...(asgs ?? []).map((a) => a.id), ...(subs ?? []).map((s) => s.id), ...(sess ?? []).map((s) => s.id)];
    await admin.from("notifications").delete().in("entity_id", entityIds.length ? entityIds : [NONE]);
    await admin.from("students").delete().in("id", studentIds.length ? studentIds : [NONE]);
    await admin.from("batches").delete().in("id", created.batches.length ? created.batches : [NONE]);

    // Kurikulum English Zero dikembalikan: versi tambahan dihapus, status/isi/materi/tugas seperti semula.
    const { data: extra } = await admin.from("curricula").select("id").eq("program_id", ezProgram.id).not("id", "in", `(${curIds.join(",") || NONE})`);
    for (const c of extra ?? []) await admin.from("curricula").delete().eq("id", c.id);
    for (const c of curBefore ?? []) {
      await admin.from("curricula").update({ status: c.status, title: c.title, notes: c.notes, published_at: c.published_at, published_by: c.published_by }).eq("id", c.id);
    }
    for (const m of modBefore ?? []) {
      await admin.from("curriculum_modules").update({ title: m.title, objectives: m.objectives, content: m.content, week: m.week }).eq("id", m.id);
    }
    const keepMat = new Set((matBefore ?? []).map((m) => m.id));
    const { data: matNow } = await admin.from("module_materials").select("id, file_path").in("module_id", modIds.length ? modIds : [NONE]);
    const newMat = (matNow ?? []).filter((m) => !keepMat.has(m.id));
    if (newMat.length) {
      await admin.from("module_materials").delete().in("id", newMat.map((m) => m.id));
      const files = newMat.map((m) => m.file_path).filter(Boolean);
      if (files.length) await admin.storage.from("learning-materials").remove(files);
    }
    const keepTask = new Map((taskBefore ?? []).map((t) => [t.id, t]));
    const { data: taskNow } = await admin.from("module_tasks").select("id").in("module_id", modIds.length ? modIds : [NONE]);
    for (const t of taskNow ?? []) {
      const orig = keepTask.get(t.id);
      if (!orig) await admin.from("module_tasks").delete().eq("id", t.id);
      else await admin.from("module_tasks").update({ title: orig.title, instructions: orig.instructions, submission_type: orig.submission_type, sort_order: orig.sort_order }).eq("id", t.id);
    }

    await admin.from("audit_log").delete().in("actor_id", created.users);
    await admin.from("audit_log").delete().in("entity_id", [...created.users, ...entityIds]);
    for (const id of new Set(created.users)) await admin.auth.admin.deleteUser(id);
    console.log("Data uji dibersihkan, kurikulum English Zero dikembalikan seperti semula.");
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
  process.exit(failed.length ? 1 : 0);
}
