// Uji ujung-ke-ujung Fase 4: rubrik dan titik assessment, assessment awal/tengah/akhir (termasuk susulan),
// progres siswa dan wali, laporan tutor, review Academic Lead (kembalikan lalu terbit), PDF, dan program lanjutan.
// Membuat akun uji (@milestone.test), menjalankan alur lewat browser headless, lalu menghapus data uji dan
// mengembalikan kurikulum English Zero (termasuk rubrik dan titik assessment) persis seperti sebelum uji.
// Jalankan: npm run e2e:fase4   (server dev harus hidup di E2E_BASE, default http://localhost:3100)
// E2E_CRON_SECRET = CRON_SECRET server dev, untuk menguji pembuatan ulang PDF. KEEP=1 untuk menyimpan data uji.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = new URL("../../e2e-output/fase4/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const created = { users: [], batches: [] };
const results = [];
const NONE = "00000000-0000-0000-0000-000000000000";
const DAY = 86400000;

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

// Supabase Auth kadang memutus koneksi sesaat; login diulang dari awal (maksimal 3 kali) sebelum dianggap gagal.
async function login(page, user) {
  const portal = /\/portal\/(student|guardian|tutor|lead|admin|owner)/;
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${BASE}/${user.team ? "tim" : "masuk"}`);
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    const ok = await page.waitForURL(portal, { timeout: 30000 }).then(() => true, () => false);
    if (ok) return;
    if (attempt === 3) throw new Error(`Login ${user.email} gagal 3 kali`);
  }
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

async function openDetails(loc) {
  if (!(await loc.evaluate((d) => d.open))) await loc.locator("summary").click();
}

const { data: programs } = await admin.from("programs").select("id, slug, name").eq("status", "active");
const ezProgram = programs.find((p) => p.slug === "english-zero");
const suProgram = programs.find((p) => p.slug === "speakup");

// Salinan kurikulum English Zero sebelum uji, untuk dikembalikan persis setelahnya.
const { data: curBefore } = await admin.from("curricula").select("*").eq("program_id", ezProgram.id);
const curIds = (curBefore ?? []).map((c) => c.id);
const { data: modBefore } = await admin.from("curriculum_modules").select("*").in("curriculum_id", curIds.length ? curIds : [NONE]);
const { data: indBefore } = await admin.from("rubric_indicators").select("*").in("curriculum_id", curIds.length ? curIds : [NONE]);
const ezCur = [...(curBefore ?? [])].sort((a, b) => b.version - a.version)[0];
const wasDraft = ezCur?.status === "draft";
const ezModules = (modBefore ?? []).filter((m) => m.curriculum_id === ezCur?.id).sort((a, b) => a.seq - b.seq);
const ezIndicators = (indBefore ?? []).filter((i) => i.curriculum_id === ezCur?.id).sort((a, b) => a.seq - b.seq);

const browser = await chromium.launch();
const pages = [];
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`  [console] ${m.text().slice(0, 300)}`));
  pages.push(page);
  return page;
};

// Mengisi satu lembar assessment siswa: skor yang sama untuk semua indikator, lalu simpan draf atau terbitkan.
async function scoreStudent(page, name, score, action) {
  const panel = page.locator("section", { has: page.locator("p.text-lg", { hasText: name }) });
  for (const ind of ezIndicators) {
    await panel.getByRole("radiogroup", { name: `${ind.label} ${name}` }).getByRole("radio", { name: new RegExp(`^${score} ·`) }).click();
  }
  await panel.getByLabel(`Catatan assessment ${name}`).fill(`Catatan ${action === "draft" ? "draf" : "terbit"} skor ${score} untuk ${name}`);
  await panel.getByRole("button", { name: action === "draft" ? "Simpan draf" : /Terbitkan nilai|Simpan perubahan nilai/ }).click();
  await panel.getByText(action === "draft" ? "Draf tersimpan" : "Nilai terbit dan tampil di progres siswa").waitFor({ timeout: 20000 });
}

try {
  if (!ezCur) throw new Error("Kurikulum English Zero tidak ditemukan (jalankan npm run db:migrate).");
  if (ezIndicators.length < 2) throw new Error("Rubrik English Zero belum terisi (jalankan npm run db:migrate).");
  const lead = await makeUser("lead", { full_name: "Lead Uji" }, ["lead"]);
  const tutor = await makeUser("tutor", { full_name: "Tutor Uji" }, ["tutor"]);
  const tutor2 = await makeUser("tutor2", { full_name: "Tutor Lain" }, ["tutor"]);
  const student = await makeUser("siswa", { full_name: "Siswa Uji", learning_goal: "percakapan" });
  const guardian = await makeUser("wali", { account_type: "guardian", full_name: "Wali Uji", child_name: "Anak Uji", child_birth_year: "2014" });
  const { data: sRow } = await admin.from("students").select("id").eq("user_id", student.id).single();
  const { data: link } = await admin.from("guardian_links").select("id, student_id").eq("guardian_id", guardian.id).single();
  await admin.from("guardian_links").update({ status: "verified" }).eq("id", link.id);
  const childId = link.student_id;

  // ---------------------------------------------------------------- Academic Lead: rubrik dan titik assessment
  const lp = await newPage();
  await login(lp, lead);
  await open(lp, `/portal/lead/kurikulum?id=${ezCur.id}`);
  const rubricTitle = await lp.getByRole("heading", { name: /^Rubrik penilaian/ }).innerText();
  const points = await lp.locator("li.lp-card-soft").allInnerTexts();
  check(
    "Kurikulum menampilkan rubrik dan titik assessment awal/tengah/akhir",
    rubricTitle.toLowerCase().includes(`${ezIndicators.length} indikator`) && /Sesi 1/.test(points[0]) && /Sesi 4/.test(points[1]) && /Sesi 8/.test(points[2]),
    `${rubricTitle}; ${points.map((p) => p.split("\n").pop()).join(", ")}`,
  );
  const firstInd = lp.locator("details", { has: lp.locator("summary", { hasText: ezIndicators[0].label }) }).first();
  await openDetails(firstInd);
  await firstInd.getByLabel(/^Skor 4/).fill(`${ezIndicators[0].descriptors[3]} (uji ${RUN})`);
  await firstInd.getByRole("button", { name: "Simpan indikator" }).click();
  await firstInd.getByText("Tersimpan").waitFor({ timeout: 20000 });
  const { data: indAfter } = await admin.from("rubric_indicators").select("descriptors").eq("id", ezIndicators[0].id).single();
  check("Lead memperbaiki penjelasan skor indikator", indAfter.descriptors[3].includes(`uji ${RUN}`));
  if (wasDraft) {
    check("Draf: setiap sesi punya pilihan titik assessment", (await lp.getByLabel("Titik assessment").count()) === ezModules.length);
    await lp.getByRole("button", { name: "Terbitkan kurikulum" }).click();
    await lp.getByRole("button", { name: "Ya, terbitkan" }).click();
    await lp.getByRole("button", { name: "Buat versi baru" }).waitFor({ timeout: 20000 });
  }
  check("Versi terbit: daftar indikator dan titik assessment terkunci", (await lp.getByLabel("Titik assessment").count()) === 0 && (await lp.getByRole("button", { name: "+ Tambah indikator" }).count()) === 0);
  await shot(lp, "01-lead-rubrik");

  // ---------------------------------------------------------------- Batch berkurikulum, sesi 1 dimulai 2 jam lalu
  const { data: batch } = await admin
    .from("batches")
    .insert({ code: `E2E4-${RUN}`.toUpperCase().slice(0, 24), program_id: ezProgram.id, curriculum_id: ezCur.id, tutor_id: tutor.id, start_date: new Date().toISOString().slice(0, 10), schedule_label: "Selasa & Kamis 19.00 WIB", meeting_url: "https://meet.google.com/uji-fase4", capacity: 6, status: "open" })
    .select("id, code")
    .single();
  created.batches.push(batch.id);
  const sessionRows = ezModules.map((m) => ({ batch_id: batch.id, seq: m.seq, module_id: m.id, topic: m.title, duration_minutes: 60, starts_at: new Date(m.seq === 1 ? Date.now() - 2 * 3600000 : Date.now() + (m.seq - 1) * 2 * DAY).toISOString() }));
  const { data: sessions } = await admin.from("class_sessions").insert(sessionRows).select("id, seq").order("seq");
  const s1 = sessions.find((s) => s.seq === 1).id;
  const s8 = sessions.find((s) => s.seq === 8).id;
  const enrollment = {};
  for (const sid of [sRow.id, childId]) {
    const { data: e } = await admin.from("enrollments").insert({ student_id: sid, batch_id: batch.id, status: "active", activated_at: new Date().toISOString(), onboarded_at: new Date().toISOString() }).select("id").single();
    enrollment[sid] = e.id;
    await admin.from("students").update({ status: "active" }).eq("id", sid);
  }
  await admin.from("attendance").insert([
    { session_id: s1, student_id: sRow.id, status: "present" },
    { session_id: s1, student_id: childId, status: "absent" },
  ]);
  await admin.from("class_sessions").update({ attendance_done_at: new Date().toISOString() }).eq("id", s1);
  // Bukti awal: tugas sesi 1 yang dikumpulkan siswa.
  const { data: a1 } = await admin.from("assignments").insert({ batch_id: batch.id, session_id: s1, title: "Rekam perkenalan pertamamu", instructions: "Perkenalkan diri 1 menit.", submission_type: "text", due_at: new Date(Date.now() + DAY).toISOString() }).select("id").single();
  await admin.from("submissions").insert({ assignment_id: a1.id, student_id: sRow.id, version: 1, text_answer: `Hello, my name is Siswa. (awal ${RUN})` });

  // ---------------------------------------------------------------- Tutor: assessment awal (siswa hadir, anak susulan)
  const tp = await newPage();
  await login(tp, tutor);
  const card = await tp.locator("a", { hasText: "Assessment perlu dinilai" }).innerText();
  check("Beranda tutor: 2 assessment perlu dinilai, 1 susulan", /^\s*2\b/.test(card) && card.includes("1 susulan"), card.replace(/\s+/g, " "));
  await open(tp, `/portal/tutor/sesi?id=${s1}`);
  check("Halaman sesi 1 menandai titik assessment awal", (await tp.getByText(/titik assessment awal \(baseline\)/).count()) === 1);
  await tp.getByRole("link", { name: "Buka lembar assessment →" }).click();
  await tp.waitForURL(/\/portal\/tutor\/assessment\?/, { timeout: 20000 });
  const childPanel = tp.locator("section", { has: tp.locator("p.text-lg", { hasText: "Anak Uji" }) });
  await childPanel.first().waitFor({ timeout: 20000 });
  const makeupBadge = await childPanel.getByText("Susulan", { exact: true }).count();
  const makeupNote = await childPanel.getByText(/nilai susulan/).count();
  check("Anak yang tidak hadir ditandai susulan", makeupBadge === 1 && makeupNote === 1, `badge ${makeupBadge}, keterangan ${makeupNote}`);
  await scoreStudent(tp, "Siswa Uji", 1, "draft");

  const sp = await newPage();
  await login(sp, student);
  await open(sp, "/portal/student/progres");
  check("Draf assessment belum terlihat siswa", (await sp.getByText(/Nilai tampil setelah tutor menerbitkan assessment awal/).count()) === 1);

  await open(tp, `/portal/tutor/assessment?batch=${batch.id}&kind=baseline`);
  await scoreStudent(tp, "Siswa Uji", 1, "publish");
  await scoreStudent(tp, "Anak Uji", 2, "publish");
  await shot(tp, "02-tutor-assessment-awal");
  await open(sp, "/portal/student/progres");
  const progressRows = await sp.locator("tbody tr").count();
  check("Siswa melihat nilai assessment awal per indikator dan bukti awal", progressRows === ezIndicators.length && (await sp.getByText(`(awal ${RUN})`).count()) === 1, `${progressRows} indikator`);
  check("Siswa melihat catatan assessment awal", (await sp.getByText("Catatan terbit skor 1 untuk Siswa Uji").count()) === 1);
  await shot(sp, "03-siswa-progres-awal");

  // ---------------------------------------------------------------- Program berjalan sampai selesai
  for (const s of sessions) await admin.from("class_sessions").update({ starts_at: new Date(Date.now() - (9 - s.seq) * DAY).toISOString() }).eq("id", s.id);
  const { data: a8 } = await admin.from("assignments").insert({ batch_id: batch.id, session_id: s8, title: "Perkenalan akhir", instructions: "Perkenalkan diri 2 menit.", submission_type: "text", due_at: new Date(Date.now() - 3600000).toISOString() }).select("id").single();
  await admin.from("submissions").insert({ assignment_id: a8.id, student_id: sRow.id, version: 1, text_answer: `Hello! I am Siswa, a designer from Jakarta. (akhir ${RUN})`, status: "accepted" });

  for (const kind of ["mid", "final"]) {
    await open(tp, `/portal/tutor/assessment?batch=${batch.id}&kind=${kind}`);
    await scoreStudent(tp, "Siswa Uji", kind === "mid" ? 2 : 3, "publish");
    await scoreStudent(tp, "Anak Uji", kind === "mid" ? 2 : 3, "publish");
  }
  const { data: allAssess } = await admin.from("assessments").select("kind, status").eq("batch_id", batch.id);
  check("Tutor menerbitkan assessment awal, tengah, dan akhir untuk 2 siswa", allAssess.length === 6 && allAssess.every((a) => a.status === "published"));

  // ---------------------------------------------------------------- Tutor: susun dan ajukan laporan
  await open(tp, "/portal/tutor/laporan");
  const { data: batchNow } = await admin.from("batches").select("status").eq("id", batch.id).single();
  check("Setelah sesi terakhir batch berstatus Selesai", batchNow.status === "completed", batchNow.status);
  check("Tutor melihat 2 laporan yang perlu disusun", (await tp.getByText("Belum disusun").count()) === 2);
  await open(tp, `/portal/tutor/laporan?id=${enrollment[sRow.id]}`);
  check("Ringkasan otomatis berisi nilai awal-tengah-akhir dan bukti awal/terbaru", (await tp.getByText("+2").count()) >= 1 && (await tp.getByText(`(akhir ${RUN})`).count()) === 1);
  await tp.getByLabel("Kekuatan siswa").fill("Siswa sudah bisa memperkenalkan diri dengan lancar dan menambah detail pekerjaan.");
  await tp.getByLabel("Yang perlu ditingkatkan").fill("Perlu memperbanyak latihan kalimat tanya dan pengucapan akhiran -ed.");
  await tp.getByLabel("Level akhir Speaking").selectOption("A2");
  await tp.getByLabel("Level akhir Listening").selectOption("A1");
  await tp.getByLabel("Level akhir Grammar").selectOption("A1");
  await tp.getByRole("checkbox", { name: /SpeakUp/ }).check();
  await tp.getByRole("button", { name: "Ajukan ke Academic Lead" }).click();
  await tp.getByText("Laporan diajukan ke Academic Lead").waitFor({ timeout: 20000 });
  const { data: rep } = await admin.from("reports").select("id, status").eq("enrollment_id", enrollment[sRow.id]).single();
  check("Laporan diajukan ke Academic Lead", rep.status === "submitted");
  await shot(tp, "04-tutor-laporan");
  await open(tp, `/portal/tutor/assessment?batch=${batch.id}&kind=final`);
  check("Setelah laporan diajukan, nilai assessment siswa terkunci", (await tp.locator("section", { has: tp.locator("p.text-lg", { hasText: "Siswa Uji" }) }).getByText(/nilai ini terkunci/).count()) === 1);

  // ---------------------------------------------------------------- Academic Lead: kembalikan lalu terbitkan
  await open(lp, "/portal/lead");
  const leadCard = await lp.locator("a", { hasText: "Laporan siap terbit" }).innerText();
  check("Beranda Lead: 1 laporan siap terbit", /^\s*1\b/.test(leadCard));
  await open(lp, `/portal/lead/laporan?id=${rep.id}`);
  await lp.getByRole("button", { name: "Kembalikan ke tutor" }).click();
  await lp.getByText(/Tulis catatan untuk tutor/).waitFor({ timeout: 20000 });
  await lp.getByLabel("Catatan untuk tutor").fill("Tambahkan contoh kalimat yang sudah dikuasai siswa.");
  await lp.getByRole("button", { name: "Kembalikan ke tutor" }).click();
  await until(async () => (await admin.from("reports").select("status").eq("id", rep.id).single()).data.status === "returned", "laporan dikembalikan");
  check("Lead mengembalikan laporan dengan catatan (catatan wajib)", true);

  await open(tp, `/portal/tutor/laporan?id=${enrollment[sRow.id]}`);
  check("Tutor melihat catatan pengembalian", (await tp.getByText(/Tambahkan contoh kalimat/).count()) === 1);
  await tp.getByLabel("Kekuatan siswa").fill("Siswa sudah bisa memperkenalkan diri dengan lancar, misalnya: I work as a designer in Jakarta.");
  await tp.getByRole("button", { name: "Ajukan ulang ke Academic Lead" }).click();
  await tp.getByText("Laporan diajukan ke Academic Lead").waitFor({ timeout: 20000 });

  await open(lp, `/portal/lead/laporan?id=${rep.id}`);
  await lp.getByLabel("Konfirmasi level Listening").selectOption("A2");
  await lp.getByRole("button", { name: "Terbitkan laporan & PDF" }).click();
  // Aksi terbit menunggu PDF selesai dibuat, jadi pdf_path terisi sebelum aksi kembali.
  await until(async () => (await admin.from("reports").select("pdf_path").eq("id", rep.id).single()).data.pdf_path, "PDF laporan tersimpan", 90000).catch(() => {});
  const { data: published } = await admin.from("reports").select("status, levels, pdf_path, summary").eq("id", rep.id).single();
  check("Lead menerbitkan laporan dengan level yang dikonfirmasi", published.levels.listening === "A2" && published.summary?.indicators?.length === ezIndicators.length);
  const pdfFile = published.pdf_path ? await admin.storage.from("report-files").download(published.pdf_path) : { data: null };
  const pdfBytes = pdfFile.data ? Buffer.from(await pdfFile.data.arrayBuffer()) : Buffer.alloc(0);
  if (pdfBytes.length) writeFileSync(fileURLToPath(new URL("laporan-uji.pdf", OUT)), pdfBytes);
  check("PDF laporan dibuat dan disimpan", pdfBytes.subarray(0, 4).toString() === "%PDF" && pdfBytes.length > 5000, `${pdfBytes.length} byte`);
  await lp.reload();
  await lp.waitForLoadState("networkidle");
  await shot(lp, "05-lead-terbit");

  // ---------------------------------------------------------------- Siswa: beranda, laporan, unduh PDF, ambil program
  await open(sp, "/portal/student");
  check("Beranda siswa: program selesai, laporan terbit, tombol Ambil program", (await sp.getByText("Program selesai · laporan terbit").count()) === 1 && (await sp.getByRole("link", { name: /Ambil program/ }).count()) === 1);
  await shot(sp, "06-siswa-beranda-selesai");
  await open(sp, "/portal/student/laporan");
  check("Halaman Laporan siswa menampilkan laporan dan rekomendasi SpeakUp", (await sp.getByText(/I work as a designer in Jakarta/).count()) === 1 && (await sp.getByText(suProgram.name, { exact: true }).count()) >= 1);
  // Tautan bertanda tangan langsung menjadi unduhan, jadi alamatnya dibaca dari permintaan tab baru.
  const [fileReq] = await Promise.all([
    sp.context().waitForEvent("request", { predicate: (r) => r.url().includes("/report-files/"), timeout: 20000 }),
    sp.getByRole("button", { name: "Unduh PDF" }).click(),
  ]);
  const fileUrl = fileReq.url();
  const fileHead = Buffer.from(await (await fetch(fileUrl)).arrayBuffer()).subarray(0, 4).toString();
  check("Siswa mengunduh PDF laporan lewat tautan aman", fileUrl.includes("token=") && fileHead === "%PDF", fileHead);
  for (const p of sp.context().pages()) if (p !== sp) await p.close();
  await shot(sp, "07-siswa-laporan");
  await sp.getByRole("link", { name: /Ambil program/ }).first().click();
  await sp.waitForURL(/\/portal\/student\/program/, { timeout: 20000 });
  check("Ambil program membuka pilihan batch tanpa placement ulang", (await sp.getByText("Selesaikan placement test dulu").count()) === 0);

  // ---------------------------------------------------------------- Wali: progres anak, laporan masih disiapkan
  const gp = await newPage();
  await login(gp, guardian);
  await open(gp, `/portal/guardian/progres?anak=${childId}`);
  check("Wali melihat progres anak (awal, tengah, akhir)", (await gp.locator("tbody tr").count()) === ezIndicators.length && (await gp.getByText("Catatan terbit skor 3 untuk Anak Uji").count()) === 1);
  await open(gp, "/portal/guardian");
  check("Beranda wali: laporan anak sedang disiapkan tutor", (await gp.getByText(/laporan sedang disiapkan tutor/).count()) === 1);
  await shot(gp, "08-wali-progres");

  // ---------------------------------------------------------------- Keamanan
  const t2 = await newPage();
  await login(t2, tutor2);
  await open(t2, `/portal/tutor/assessment?batch=${batch.id}&kind=final`);
  check("Tutor lain tidak bisa membuka lembar assessment batch orang lain", (await t2.getByText(/bukan bagian dari kelasmu/).count()) === 1);
  await open(t2, `/portal/tutor/laporan?id=${enrollment[sRow.id]}`);
  check("Tutor lain tidak bisa membuka laporan siswa batch orang lain", (await t2.getByText(/bukan bagian dari kelasmu/).count()) === 1);
  await open(sp, "/portal/lead/laporan");
  check("Siswa tidak bisa membuka review laporan Lead", !sp.url().includes("/portal/lead"));

  // ---------------------------------------------------------------- Jadwal harian membuat ulang PDF yang hilang
  if (process.env.E2E_CRON_SECRET) {
    await admin.storage.from("report-files").remove([published.pdf_path]);
    await admin.from("reports").update({ pdf_path: null }).eq("id", rep.id);
    const res = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${process.env.E2E_CRON_SECRET}` } });
    const body = await res.json();
    const { data: again } = await admin.from("reports").select("pdf_path").eq("id", rep.id).single();
    check("Jadwal harian membuat ulang PDF laporan yang belum tersimpan", res.ok && body.pdfs >= 1 && Boolean(again.pdf_path), `${body.pdfs} PDF`);
  }

  // ---------------------------------------------------------------- Notifikasi tercatat
  const { data: notes } = await admin.from("notifications").select("template, recipient_id").eq("entity_id", rep.id);
  const submittedToLead = (notes ?? []).some((n) => n.template === "report_submitted" && n.recipient_id === lead.id);
  const returnedToTutor = (notes ?? []).some((n) => n.template === "report_returned" && n.recipient_id === tutor.id);
  const publishedToStudent = (notes ?? []).some((n) => n.template === "report_published" && n.recipient_id === student.id);
  check("Notifikasi laporan tercatat (diajukan ke Lead, dikembalikan ke tutor, terbit ke siswa)", submittedToLead && returnedToTutor && publishedToStudent, `${notes?.length ?? 0} pesan`);
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
    const batches = created.batches.length ? created.batches : [NONE];
    const { data: studs } = await admin.from("students").select("id").or(`user_id.in.(${users}),created_by.in.(${users})`);
    const studentIds = (studs ?? []).map((s) => s.id);
    const { data: reps } = await admin.from("reports").select("id, pdf_path").in("batch_id", batches);
    const pdfs = (reps ?? []).map((r) => r.pdf_path).filter(Boolean);
    if (pdfs.length) await admin.storage.from("report-files").remove(pdfs);
    const { data: asgs } = await admin.from("assignments").select("id").in("batch_id", batches);
    const { data: subs } = await admin.from("submissions").select("id").in("assignment_id", (asgs ?? []).map((a) => a.id).concat(NONE));
    const { data: sess } = await admin.from("class_sessions").select("id").in("batch_id", batches);
    const { data: ass } = await admin.from("assessments").select("id").in("batch_id", batches);
    const entityIds = [...batches, ...(reps ?? []).map((r) => r.id), ...(asgs ?? []).map((a) => a.id), ...(subs ?? []).map((s) => s.id), ...(sess ?? []).map((s) => s.id), ...(ass ?? []).map((a) => a.id), ...created.users];
    await admin.from("notifications").delete().in("entity_id", entityIds);
    await admin.from("notifications").delete().in("recipient_id", created.users.length ? created.users : [NONE]);
    await admin.from("students").delete().in("id", studentIds.length ? studentIds : [NONE]);
    await admin.from("batches").delete().in("id", batches);

    // Kurikulum English Zero dikembalikan: versi tambahan dihapus; status, isi, rubrik, dan titik assessment seperti semula.
    const { data: extra } = await admin.from("curricula").select("id").eq("program_id", ezProgram.id).not("id", "in", `(${curIds.join(",") || NONE})`);
    for (const c of extra ?? []) await admin.from("curricula").delete().eq("id", c.id);
    for (const c of curBefore ?? []) {
      await admin.from("curricula").update({ status: c.status, title: c.title, notes: c.notes, published_at: c.published_at, published_by: c.published_by }).eq("id", c.id);
    }
    for (const m of modBefore ?? []) {
      await admin.from("curriculum_modules").update({ title: m.title, objectives: m.objectives, content: m.content, week: m.week, assessment: m.assessment }).eq("id", m.id);
    }
    const keepInd = new Map((indBefore ?? []).map((i) => [i.id, i]));
    const { data: indNow } = await admin.from("rubric_indicators").select("id").in("curriculum_id", curIds.length ? curIds : [NONE]);
    for (const i of indNow ?? []) {
      const orig = keepInd.get(i.id);
      if (!orig) await admin.from("rubric_indicators").delete().eq("id", i.id);
      else await admin.from("rubric_indicators").update({ label: orig.label, descriptors: orig.descriptors, skill: orig.skill }).eq("id", i.id);
    }

    await admin.from("audit_log").delete().in("actor_id", created.users.length ? created.users : [NONE]);
    for (const id of new Set(created.users)) await admin.auth.admin.deleteUser(id);
    // Setelah akun dihapus, karena penghapusan akun ikut menulis audit (role dicabut).
    await admin.from("audit_log").delete().in("entity_id", entityIds);
    console.log("Data uji dibersihkan, kurikulum English Zero dikembalikan seperti semula.");
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
  process.exit(failed.length ? 1 : 0);
}
