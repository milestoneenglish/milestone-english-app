// Uji ujung-ke-ujung Fase 1 di aplikasi yang sedang berjalan dan Supabase sungguhan.
// Membuat akun uji (@milestone.test), menjalankan alur lewat browser headless, lalu menghapus data uji.
// Jalankan: npm run e2e:fase1   (server dev harus hidup di E2E_BASE, default http://localhost:3100)
// KEEP=1 untuk menyimpan data uji.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const OUT = new URL("../../e2e-output/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const created = { users: [], guestAttempts: [] };
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

// Kunci jawaban dibaca langsung dari database uji untuk mengatur berapa soal yang dijawab benar.
const { data: bank } = await admin.from("placement_questions").select("prompt, section, answer_index, options").eq("active", true);
const answerOf = (prompt) => bank.find((q) => q.prompt === prompt);

async function answerSection(page, correctRatio) {
  const sets = page.locator("fieldset");
  const n = await sets.count();
  for (let i = 0; i < n; i++) {
    const set = sets.nth(i);
    const prompt = (await set.locator("p").first().innerText()).replace(/^\d+\.\s*/, "").trim();
    const q = answerOf(prompt);
    const right = i < Math.round(n * correctRatio);
    const idx = q ? (right ? q.answer_index : (q.answer_index + 1) % q.options.length) : 0;
    await set.locator("label").nth(idx).click();
    await page.waitForTimeout(150);
  }
}

async function next(page) {
  await page.getByRole("button", { name: /^Lanjut ke/ }).click();
  await page.waitForTimeout(400);
}

async function takeTest(page, { ratio, writing = true, speaking = true, tag }) {
  await page.waitForSelector("text=Grammar");
  await answerSection(page, ratio);
  await next(page);
  await answerSection(page, ratio);
  await next(page);
  // Listening: satu kali putar mengurangi sisa kesempatan menjadi 1 dari 2.
  const play = page.getByRole("button", { name: /Putar audio|Sedang diputar|Kesempatan habis/ }).first();
  await play.click();
  await page.waitForSelector("text=Sisa putar: 1 dari 2", { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => window.speechSynthesis?.cancel());
  if (tag === "guest") {
    const before = await page.locator("text=/Sisa putar: \\d dari 2/").first().innerText();
    const playError = await page.locator("text=/sudah diputar|Gagal memutar|tidak ditemukan|akses/").allInnerTexts();
    check("Listening: hitungan putar berkurang setelah diputar", before.includes("1 dari 2"), `${before} ${playError.join(" ")}`);
  }
  await answerSection(page, ratio);
  await next(page);
  if (writing) {
    await page.locator("textarea").fill(
      "Every day I wake up at six and prepare breakfast for my family. Then I go to the office by motorbike. I work as an administrator in a small company, so I write many emails and talk with customers. In the evening I like to cook and watch films. I want to improve my English because my company works with clients from other countries, and I want to speak more confidently in meetings and travel abroad in the future.",
    );
    await page.waitForTimeout(1500);
  }
  await next(page);
  if (speaking) {
    const recs = page.getByRole("button", { name: "Mulai rekam" });
    const count = await recs.count();
    for (let i = 0; i < count; i++) {
      await page.getByRole("button", { name: /Mulai rekam/ }).first().click();
      await page.waitForTimeout(2500);
      await page.getByRole("button", { name: /Berhenti/ }).click();
      await page.getByText("Tersimpan", { exact: true }).nth(i).waitFor({ timeout: 45000 });
    }
    const players = await page.locator("audio").count();
    check(`Speaking (${tag}): rekaman terunggah dan bisa diputar ulang`, players === count, `${players}/${count} rekaman`);
  }
  await next(page);
  await page.waitForSelector("text=Semua jawaban tersimpan", { timeout: 30000 });
  await page.getByRole("button", { name: "Kirim jawaban" }).click();
  await page.getByRole("button", { name: "Ya, kirim" }).click();
  await page.waitForURL(/\/(placement\/hasil|portal)/, { timeout: 30000 });
}

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const pages = [];
const newPage = async () => {
  const page = await (await browser.newContext({ permissions: ["microphone"], viewport: { width: 1280, height: 900 } })).newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`  [console] ${m.text().slice(0, 300)}`));
  pages.push(page);
  return page;
};

try {
  // ---------------------------------------------------------------- Tamu → daftar
  const guest = await newPage();
  await guest.goto(`${BASE}/placement`);
  await guest.getByRole("button", { name: "Mulai tes gratis" }).click();
  await guest.waitForURL(/\/placement\/tes\//);
  const guestAttemptId = guest.url().split("/").pop();
  created.guestAttempts.push(guestAttemptId);
  check("Tamu bisa memulai tes gratis", Boolean(guestAttemptId));
  await shot(guest, "01-tes-grammar");

  // Jawaban tersimpan: muat ulang halaman dan pilihan masih ada.
  await guest.locator("fieldset").first().locator("label").nth(1).click();
  await guest.waitForSelector("text=Semua jawaban tersimpan", { timeout: 20000 });
  await guest.reload();
  check("Jawaban tersimpan setelah halaman dimuat ulang", await guest.locator("fieldset").first().locator("input:checked").count() === 1);

  await takeTest(guest, { ratio: 0.75, tag: "guest" });
  check("Tamu melihat hasil ringkas setelah kirim", guest.url().includes("/placement/hasil/") && (await guest.locator("text=Perkiraan level").count()) > 0, guest.url());
  await shot(guest, "02-hasil-tamu");

  // Daftar lewat form di browser yang sama.
  const adult = { email: email("siswa"), password: password() };
  await guest.goto(`${BASE}/daftar?program=english-for-career`);
  check("Halaman daftar memberi tahu tes gratis akan tersambung", (await guest.locator("text=otomatis tersambung").count()) > 0);
  await guest.getByLabel("Nama lengkap").fill("Uji Siswa Dewasa");
  await guest.getByLabel("Nomor WhatsApp").fill("081234567890");
  await guest.getByLabel("Email", { exact: true }).fill(adult.email);
  await guest.getByLabel("Tahun lahir").fill("1995");
  await guest.getByLabel("Tujuan belajar").selectOption("karier");
  await guest.getByLabel(/^Password/).fill(adult.password);
  await guest.getByLabel("Ulangi password").fill(adult.password);
  await guest.locator("input[type=checkbox]").check();
  await guest.getByRole("button", { name: "Daftar dan verifikasi email" }).click();
  await guest.waitForSelector("text=/Cek email kamu|tidak bisa dipakai|dibatasi|gagal|Terlalu banyak/", { timeout: 30000 });
  const signupText = await guest.locator("main").innerText();
  // Supabase menolak domain .test untuk pendaftaran publik; yang diuji di sini: form terkirim dan pesannya jelas.
  const formOk = signupText.includes("Cek email kamu") || signupText.includes("Alamat email tidak bisa dipakai") || signupText.includes("sedang dibatasi");
  check("Form daftar terkirim ke Supabase dengan pesan yang jelas", formOk, signupText.split("\n").find((l) => /Cek email|tidak bisa|dibatasi|gagal/.test(l)));
  await shot(guest, "03-daftar-cek-email");

  let adultUser = (await admin.from("profiles").select("id").eq("email", adult.email).maybeSingle()).data;
  // Email bawaan Supabase hanya terkirim ke anggota tim, jadi link verifikasi dibuat langsung dari server.
  const link = await admin.auth.admin.generateLink({
    type: adultUser ? "magiclink" : "signup",
    email: adult.email,
    password: adult.password,
    options: { data: { account_type: "student", full_name: "Uji Siswa Dewasa", phone: "+6281234567890", birth_year: "1995", learning_goal: "karier", program_slug: "english-for-career" } },
  });
  if (link.error) throw new Error(`generateLink: ${link.error.message}`);
  adultUser = { id: link.data.user.id };
  created.users.push(adultUser.id);
  await guest.goto(`${BASE}/auth/callback?token_hash=${link.data.properties.hashed_token}&type=${link.data.properties.verification_type}`);
  await guest.waitForURL(/\/portal\/student/, { timeout: 30000 });
  check("Link verifikasi email membuka portal siswa", guest.url().includes("/portal/student"));
  const { data: adultStudent } = await admin.from("students").select("id, interested_program_id").eq("user_id", adultUser.id).single();
  const { data: claimed } = await admin.from("placement_attempts").select("id").eq("student_id", adultStudent.id);
  check("Tes gratis tersambung ke akun baru", claimed?.[0]?.id === guestAttemptId);
  check("Beranda menampilkan status sedang dinilai", (await guest.locator("text=sedang dinilai tutor").count()) > 0);
  await shot(guest, "04-beranda-siswa-menunggu");

  // ---------------------------------------------------------------- Wali
  const guardianUser = await makeUser("wali", { account_type: "guardian", full_name: "Uji Wali", phone: "+6281300000001", child_name: "Uji Anak Satu", child_birth_year: "2016", relationship: "orang_tua", learning_goal: "sekolah" });
  const gp = await newPage();
  await login(gp, guardianUser);
  check("Wali masuk ke portal wali", gp.url().includes("/portal/guardian"));
  check("Beranda wali menampilkan anak dan status verifikasi", (await gp.locator("text=Uji Anak Satu").count()) > 0 && (await gp.locator("text=Menunggu verifikasi admin").count()) > 0);
  await shot(gp, "05-beranda-wali");
  await gp.getByRole("button", { name: /Mulai placement/ }).click();
  await gp.waitForURL(/\/placement\/tes\//);
  check("Tes anak menampilkan nama anak", (await gp.locator("text=Uji Anak Satu").count()) > 0);
  await takeTest(gp, { ratio: 0.5, speaking: false, tag: "anak" });
  check("Setelah kirim, wali kembali ke portal", gp.url().includes("/portal/guardian"));
  await gp.goto(`${BASE}/portal/guardian/anak`);
  await gp.waitForLoadState("networkidle");
  await gp.getByLabel("Nama lengkap anak").fill("Uji Anak Dua");
  await gp.getByLabel("Tahun lahir").fill("2013");
  await gp.getByLabel("Tujuan belajar").selectOption("percakapan");
  await gp.getByRole("button", { name: "Tambah anak" }).click();
  await gp.waitForSelector("text=Anak berhasil ditambahkan", { timeout: 20000 });
  check("Wali bisa menambah anak kedua", (await gp.locator("text=Uji Anak Dua").count()) > 0);

  // ---------------------------------------------------------------- Siswa langsung dari portal
  const studentUser = await makeUser("siswa2", { full_name: "Uji Siswa Portal", phone: "+6281300000002", birth_year: "2000", learning_goal: "akademik" });
  const sp = await newPage();
  await login(sp, studentUser);
  check("Siswa baru melihat langkah 'Kerjakan placement test'", (await sp.locator("text=Kerjakan placement test").count()) > 0);
  await shot(sp, "06-beranda-calon-siswa");
  await sp.getByRole("button", { name: /Mulai placement/ }).click();
  await sp.waitForURL(/\/placement\/tes\//);
  await takeTest(sp, { ratio: 0.9, tag: "siswa" });
  check("Siswa kembali ke portal setelah kirim", sp.url().includes("/portal/student"));

  // Keamanan: siswa tidak bisa membuka portal staf; tamu lain tidak bisa membuka tes siswa.
  await sp.goto(`${BASE}/portal/lead/placement`);
  check("Siswa tidak bisa membuka portal Academic Lead", sp.url().endsWith("/portal/student"), sp.url());
  const { data: spStudent } = await admin.from("students").select("id").eq("user_id", studentUser.id).single();
  const { data: spAttempt } = await admin.from("placement_attempts").select("id").eq("student_id", spStudent.id).single();
  const stranger = await newPage();
  await stranger.goto(`${BASE}/placement/tes/${spAttempt.id}`);
  check("Orang lain tidak bisa membuka tes milik siswa", (await stranger.locator("text=Tes tidak bisa dibuka").count()) > 0);

  // ---------------------------------------------------------------- Staf
  const lead = await makeUser("lead", { full_name: "Uji Academic Lead" }, ["lead"]);
  const tutor = await makeUser("tutor", { full_name: "Uji Tutor" }, ["tutor"]);
  const opsAdmin = await makeUser("admin", { full_name: "Uji Admin" }, ["admin"]);
  await admin.from("profiles").update({ full_name: "Uji Tutor" }).eq("id", tutor.id);

  const lp = await newPage();
  await login(lp, lead);
  await lp.goto(`${BASE}/portal/lead/placement`);
  await lp.waitForLoadState("networkidle");
  const waitingRows = await lp.locator("tbody tr").filter({ hasText: "Uji " }).count();
  check("Lead melihat 3 tes menunggu penilaian", waitingRows === 3, `${waitingRows} baris`);
  check("Lead diingatkan tes yang belum punya penilai", (await lp.locator("text=belum punya penilai").count()) > 0);
  await shot(lp, "07-lead-antrean");
  for (let i = 0; i < 3; i++) {
    const row = lp.locator("tbody tr").nth(i);
    await row.locator("select").selectOption({ label: "Uji Tutor" });
    await row.getByRole("button", { name: "Tugaskan" }).click();
    await row.getByRole("button", { name: "Ganti penilai" }).waitFor({ timeout: 20000 });
  }
  const { data: assigned } = await admin.from("placement_attempts").select("id").eq("evaluator_id", tutor.id);
  check("Lead menugaskan tutor ke 3 tes", assigned?.length === 3, `${assigned?.length}`);

  const tp = await newPage();
  await login(tp, tutor);
  await tp.goto(`${BASE}/portal/tutor/placement`);
  check("Tutor melihat 3 tes yang ditugaskan", (await tp.locator("tbody tr").count()) >= 3);
  for (let i = 0; i < 3; i++) {
    await tp.goto(`${BASE}/portal/tutor/placement`);
    await tp.getByRole("link", { name: "Buka →" }).first().click();
    await tp.waitForSelector("text=Penilaian");
    await tp.waitForLoadState("networkidle");
    if (i === 0) await shot(tp, "08-tutor-menilai");
    const selects = tp.locator("form select");
    const n = await selects.count();
    for (let s = 0; s < n; s++) await selects.nth(s).selectOption(String(2 + ((s + i) % 3)));
    await tp.locator("form textarea").fill("Kosakata cukup baik; latih kelancaran dan bentuk past tense.");
    await tp.getByRole("button", { name: "Simpan penilaian" }).click();
    await tp.waitForURL(/\/portal\/tutor\/placement$/, { timeout: 30000 });
  }
  const { data: reviewed } = await admin.from("placement_attempts").select("id, levels, recommended_program_ids").eq("status", "reviewed").eq("evaluator_id", tutor.id);
  check("Tutor menyelesaikan 3 penilaian", reviewed?.length === 3, `${reviewed?.length}`);
  check("Penilaian menghasilkan level keseluruhan dan rekomendasi program", reviewed?.every((r) => r.levels.overall && r.recommended_program_ids.length > 0));

  await lp.goto(`${BASE}/portal/lead/placement?tab=siap`);
  for (let i = 0; i < 3; i++) {
    await lp.goto(`${BASE}/portal/lead/placement?tab=siap`);
    await lp.getByRole("link", { name: "Buka →" }).first().click();
    await lp.waitForSelector("text=Terbitkan hasil");
    await lp.waitForLoadState("networkidle");
    if (i === 0) await shot(lp, "09-lead-terbitkan");
    await lp.getByRole("button", { name: "Terbitkan hasil" }).click();
    await lp.waitForURL(/tab=terbit/, { timeout: 30000 });
  }
  const { data: published } = await admin.from("placement_attempts").select("id").eq("status", "published").eq("evaluator_id", tutor.id);
  check("Lead menerbitkan 3 hasil", published?.length === 3);

  // ---------------------------------------------------------------- Hasil terlihat
  await guest.goto(`${BASE}/portal/student`);
  check("Siswa melihat level keseluruhan dan program rekomendasi", (await guest.locator("text=Level keseluruhan").count()) > 0 && (await guest.locator("text=Program yang direkomendasikan").count()) > 0);
  check("Tahap perjalanan siswa maju ke 'Pilih kelas & bayar'", (await guest.locator("text=Pilih jadwal kelas dan lakukan pembayaran").count()) > 0);
  await shot(guest, "10-hasil-siswa");
  await gp.goto(`${BASE}/portal/guardian`);
  check("Wali melihat hasil placement anak", (await gp.locator("text=Level keseluruhan").count()) > 0);
  await shot(gp, "11-hasil-wali");

  // ---------------------------------------------------------------- Admin
  const ap = await newPage();
  await login(ap, opsAdmin);
  await ap.goto(`${BASE}/portal/admin/pendaftaran`);
  check("Admin melihat semua pendaftar uji", (await ap.locator("tbody tr").filter({ hasText: "Uji " }).count()) >= 4);
  await shot(ap, "12-admin-pendaftaran");
  await ap.goto(`${BASE}/portal/admin/siswa-wali`);
  await ap.waitForLoadState("networkidle");
  const pendingBefore = await ap.getByRole("button", { name: "Verifikasi" }).count();
  await ap.getByRole("button", { name: "Verifikasi" }).first().click();
  await ap.waitForFunction((n) => document.querySelectorAll("button").length && [...document.querySelectorAll("button")].filter((b) => b.textContent === "Verifikasi").length < n, pendingBefore, { timeout: 20000 }).catch(() => {});
  const pendingAfter = await ap.getByRole("button", { name: "Verifikasi" }).count();
  const { data: verifiedLinks } = await admin.from("guardian_links").select("id").eq("guardian_id", guardianUser.id).eq("status", "verified");
  const alertText = await ap.locator("text=/gagal|sudah diputuskan/").allInnerTexts();
  check("Admin memverifikasi hubungan wali-anak", pendingAfter === pendingBefore - 1 && verifiedLinks?.length === 1, `${pendingBefore} → ${pendingAfter}, DB terverifikasi ${verifiedLinks?.length} ${alertText.join(" ")}`);
  await shot(ap, "14-admin-wali");

  // ---------------------------------------------------------------- Tes ulang
  await lp.goto(`${BASE}/portal/lead/placement?id=${spAttempt.id}`);
  await lp.waitForLoadState("networkidle");
  await lp.locator("textarea").fill("Gangguan koneksi saat bagian listening.");
  await lp.getByRole("button", { name: "Izinkan tes ulang" }).click();
  await lp.waitForSelector("text=Tes ulang dibuat", { timeout: 20000 });
  await sp.goto(`${BASE}/portal/student`);
  check("Siswa melihat tes ulang yang disetujui", (await sp.locator("text=Tes ulang placement sudah disetujui").count()) > 0);

  await lp.goto(`${BASE}/portal/lead/bank-soal`);
  check("Lead membuka bank soal dengan 12 soal grammar aktif", (await lp.locator("text=12 soal aktif").count()) > 0);
  await shot(lp, "13-bank-soal");
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
    const { data: studs } = await admin.from("students").select("id").or(`user_id.in.(${created.users.join(",")}),created_by.in.(${created.users.join(",")})`);
    const studentIds = (studs ?? []).map((s) => s.id);
    const { data: atts } = await admin.from("placement_attempts").select("id").or(`id.in.(${created.guestAttempts.join(",") || "00000000-0000-0000-0000-000000000000"}),student_id.in.(${studentIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
    for (const a of atts ?? []) {
      const { data: files } = await admin.storage.from("placement-answers").list(a.id);
      if (files?.length) await admin.storage.from("placement-answers").remove(files.map((f) => `${a.id}/${f.name}`));
    }
    await admin.from("placement_attempts").delete().in("id", (atts ?? []).map((a) => a.id));
    await admin.from("students").delete().in("id", studentIds);
    await admin.from("audit_log").delete().in("actor_id", created.users);
    await admin.from("audit_log").delete().in("entity_id", created.users);
    for (const id of new Set(created.users)) await admin.auth.admin.deleteUser(id);
    console.log("Data uji dibersihkan.");
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
  process.exit(failed.length ? 1 : 0);
}
