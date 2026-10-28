// Data contoh untuk uji coba manual seluruh alur: 7 akun demo (Owner, Admin, Lead, Tutor, Siswa, Wali, Siswa Baru),
// 3 batch SpeakUp (berjalan, selesai, buka pendaftaran), siswa contoh tanpa akun, absensi, tugas, feedback, nilai,
// laporan, survei, observasi, tiket, dan pengeluaran. Akun demo ditandai app_metadata.demo, sehingga data contoh
// beserta semua yang dibuat lewat akun demo selama uji coba bisa dihapus bersih.
// Jalankan: npm run demo:isi [-- email@gmail.com]   (alamat akun memakai alias plus email itu; tanpa email: @milestone.test)
//           npm run demo:hapus
// Logika isi/hapus menerima koneksi database, pembuat akun, dan storage dari luar, sehingga juga diuji di PGlite
// (tests/demo-data.test.ts).
import { createClient } from "@supabase/supabase-js";
import { randomInt, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";

const id = () => randomUUID();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Koneksi ke database Supabase kadang putus sesaat. Transaksi yang gagal karena itu dibatalkan utuh oleh Postgres,
// jadi aman diulang dari awal.
const CONNECTION_ERRORS = ["CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT", "EPIPE"];
async function withRetry(fn, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!CONNECTION_ERRORS.includes(e.code) || i >= attempts) throw e;
      console.warn(`Koneksi ke database terputus (${e.code}), mencoba lagi (${i}/${attempts - 1})...`);
      await sleep(2000 * i);
    }
  }
}

// ---------------------------------------------------------------------------
// Waktu: semua tanggal relatif terhadap hari ini (WIB), supaya data selalu tampak "sedang berjalan".
// ---------------------------------------------------------------------------

const DAY = 86400000;
const WIB = 7 * 3600000;
const nowWib = new Date(Date.now() + WIB);
const MIDNIGHT = Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()) - WIB;
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const at = (days, hour = 0, minute = 0) => new Date(MIDNIGHT + days * DAY + (hour * 60 + minute) * 60000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const dateOf = (days) => new Date(MIDNIGHT + WIB + days * DAY).toISOString().slice(0, 10);
const dayName = (days) => HARI[new Date(MIDNIGHT + WIB + days * DAY).getUTCDay()];

// ---------------------------------------------------------------------------
// Akun demo
// ---------------------------------------------------------------------------

export const ACCOUNTS = [
  { key: "owner", label: "Owner", name: "Owner Demo", role: "owner" },
  { key: "admin", label: "Admin Operasional", name: "Admin Demo", role: "admin" },
  { key: "lead", label: "Academic Lead", name: "Lead Demo", role: "lead" },
  { key: "tutor", label: "Tutor", name: "Tutor Demo", role: "tutor" },
  { key: "siswa", label: "Siswa (kelas berjalan)", name: "Raka Pratama", meta: { account_type: "student", birth_year: "1999", learning_goal: "percakapan", program_slug: "speakup" } },
  { key: "wali", label: "Wali (2 anak)", name: "Ratna Wijaya", meta: { account_type: "guardian" } },
  { key: "baru", label: "Siswa Baru (belum placement)", name: "Nadia Putri", meta: { account_type: "student", birth_year: "2001", learning_goal: "percakapan", program_slug: "speakup" } },
];

export const emailFor = (key, baseEmail) => (baseEmail ? baseEmail.replace("@", `+demo-${key}@`) : `demo-${key}@milestone.test`);

// Isi app_metadata akun demo: staf langsung aktif tanpa wajib ganti password.
export const appMetadata = (account) => (account.role ? { demo: true, provisioned: true, must_change_password: false } : { demo: true });

// 12 karakter acak, selalu berisi huruf dan angka. Tanpa karakter yang mirip (0/O, 1/l).
function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Menyisipkan banyak baris sekaligus; kolom yang tidak disebut memakai null, jadi setiap baris harus lengkap.
async function put(tx, table, rows) {
  if (!rows.length) return;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].join(", ");
  await tx.unsafe(`insert into public.${table} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${table}, $1::text::jsonb)`, [JSON.stringify(rows)]);
}

// PDF satu halaman sebagai contoh bukti transfer.
function samplePdf(lines) {
  const text = lines.map((l, i) => `${i ? "0 -22 Td " : ""}(${l}) Tj`).join(" ");
  const stream = `BT /F1 13 Tf 24 150 Td ${text} ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 320 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj${o}endobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

// ---------------------------------------------------------------------------
// Placement: level per keterampilan menjadi skor dan rubrik yang konsisten dengan aturan penilaian.
// ---------------------------------------------------------------------------

const LEVELS = ["Pre-A1", "A1", "A2", "B1", "B2"];
const PERCENT = { "Pre-A1": 0.1, A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.9 };
const RUBRIC = { "Pre-A1": [1, 1, 1, 2], A1: [2, 2, 1, 2], A2: [3, 2, 2, 3], B1: [3, 3, 3, 4], B2: [4, 4, 3, 4] };
const QUESTIONS = { grammar: 12, reading: 8, listening: 6 };

function placementRow(studentId, daysAgo, [grammar, reading, listening, writing, speaking], refs) {
  const levels = { grammar, reading, listening, writing, speaking };
  const avg = Object.values(levels).reduce((s, l) => s + LEVELS.indexOf(l), 0) / 5;
  const rubric = (level, keys) => Object.fromEntries(keys.map((k, i) => [k, RUBRIC[level][i]]));
  const start = at(-daysAgo, 10);
  return {
    id: id(),
    student_id: studentId,
    status: "published",
    started_at: start,
    submitted_at: at(-daysAgo, 10, 45),
    auto_scores: Object.fromEntries(Object.entries(QUESTIONS).map(([s, total]) => [s, { correct: Math.round(total * PERCENT[levels[s]]), total }])),
    levels: { ...levels, overall: LEVELS[Math.floor(avg)] },
    evaluator_id: refs.lead,
    assigned_at: at(-daysAgo, 11),
    writing_rubric: rubric(writing, ["task", "organization", "vocabulary", "grammar"]),
    speaking_rubric: rubric(speaking, ["fluency", "pronunciation", "vocabulary", "content"]),
    review_comment: "Data contoh: jawaban terbuka sudah dinilai.",
    reviewed_at: at(-daysAgo + 1, 9),
    recommended_program_ids: [refs.program],
    lead_note: "SpeakUp cocok untuk melatih percakapan sehari-hari.",
    published_by: refs.lead,
    published_at: at(-daysAgo + 1, 10),
    created_at: start,
  };
}

// ---------------------------------------------------------------------------
// Isi data contoh
// ---------------------------------------------------------------------------

// ctx: { sql, createAccount(account, email, password) => id, storage: { upload, list, remove } }
export async function isi(ctx, { baseEmail, password = generatePassword() } = {}) {
  const { sql } = ctx;
  const [{ n }] = await sql`select count(*)::int as n from auth.users where raw_app_meta_data ->> 'demo' = 'true'`;
  if (n) throw new Error("Data contoh sudah ada. Jalankan npm run demo:hapus dulu bila ingin mengisinya ulang.");
  const [program] = await sql`select id, name, price_idr from public.programs where slug = 'speakup' and status = 'active'`;
  const [nextProgram] = await sql`select id from public.programs where slug = 'english-circle'`;
  const [curriculum] = await sql`
    select id, status from public.curricula where program_id = ${program?.id ?? null} and status in ('published', 'draft')
    order by (status = 'published') desc, version desc limit 1`;
  if (!program || !curriculum) throw new Error("Program SpeakUp aktif dan kurikulumnya belum ada. Jalankan npm run db:migrate dulu.");
  const modules = await sql`
    select m.id, m.seq, m.title, m.assessment, t.id as task_id, t.title as task_title, t.instructions
    from public.curriculum_modules m
    left join lateral (select * from public.module_tasks t where t.module_id = m.id order by t.sort_order limit 1) t on true
    where m.curriculum_id = ${curriculum.id} order by m.seq`;
  const indicators = (await sql`select id from public.rubric_indicators where curriculum_id = ${curriculum.id} order by seq`).map((r) => r.id);
  const point = Object.fromEntries(modules.filter((m) => m.assessment).map((m) => [m.assessment, m.seq]));
  if (modules.length !== 8 || modules.some((m) => !m.task_id) || indicators.length < 2 || !point.baseline || !point.mid || !point.final) {
    throw new Error("Kurikulum SpeakUp sudah diubah (bukan 8 sesi dengan tugas, rubrik, dan titik assessment lengkap). Data contoh tidak diisi.");
  }

  const u = {};
  try {
    for (const account of ACCOUNTS) u[account.key] = await ctx.createAccount(account, emailFor(account.key, baseEmail), password);
    const proof = await withRetry(() => sql.begin((tx) => seed(tx, { u, program, nextProgram, curriculum, modules, indicators, point })));
    const pdf = samplePdf(["CONTOH BUKTI TRANSFER", "Bank BCA a.n. Eka Saputra", `Rp${program.price_idr.toLocaleString("id-ID")}`, "Data uji coba, bukan transaksi asli"]);
    // Satu file contoh yang gagal terunggah tidak membatalkan seluruh data contoh.
    await ctx.storage.upload("payment-proofs", proof, pdf, "application/pdf").catch((e) => {
      console.warn(`Peringatan: contoh bukti transfer Eka tidak terunggah (${e.message}); file bukti itu tidak bisa dibuka Admin.`);
    });
  } catch (e) {
    // Data yang sempat dibuat dihapus kembali, supaya pengisian bisa langsung diulang.
    await hapus(ctx).catch((cleanup) => {
      e.message += `. Data yang sempat dibuat juga gagal dihapus (${cleanup.message}); jalankan npm run demo:hapus`;
    });
    throw e;
  }
  return { password, accounts: ACCOUNTS.map((a) => ({ ...a, id: u[a.key], email: emailFor(a.key, baseEmail) })) };
}

async function seed(tx, { u, program, nextProgram, curriculum, modules, indicators, point }) {
  const refs = { lead: u.lead, program: program.id };

  // Role staf; role siswa/wali sudah diberikan saat akun dibuat.
  await put(tx, "user_roles", ACCOUNTS.filter((a) => a.role).map((a) => ({ user_id: u[a.key], role: a.role })));

  // Kurikulum SpeakUp diterbitkan atas nama Lead demo (dikembalikan ke draf saat data contoh dihapus).
  if (curriculum.status === "draft") {
    await tx`update public.curricula set status = 'published', published_at = now(), published_by = ${u.lead} where id = ${curriculum.id}`;
  }

  // Siswa: Raka (akun sendiri), Sinta dan Dewi (anak wali, tanpa akun), dan siswa lain tanpa akun.
  const [raka] = await tx`select id from public.students where user_id = ${u.siswa}`;
  await tx`update public.students set status = 'active', created_at = ${at(-26, 20)} where id = ${raka.id}`;
  const st = { raka: { id: raka.id, name: "Raka Pratama", by: u.siswa } };
  const others = [
    ["sinta", "Sinta Wijaya", 2008, u.wali, -26, "active"],
    ["ahmad", "Ahmad Fauzi", 1996, u.admin, -25, "active"],
    ["putri", "Putri Lestari", 1998, u.admin, -24, "active"],
    ["budi", "Budi Santoso", 1994, u.admin, -62, "active"],
    ["dewi", "Dewi Wijaya", 2007, u.wali, -62, "active"],
    ["eka", "Eka Saputra", 2000, u.admin, -3, "prospect"],
  ];
  await put(tx, "students", others.map(([key, name, year, by, day, status]) => {
    st[key] = { id: id(), name, by };
    return { id: st[key].id, full_name: name, birth_year: year, learning_goal: "percakapan", interested_program_id: program.id, status, created_by: by, created_at: at(day, 19) };
  }));
  await put(tx, "guardian_links", ["sinta", "dewi"].map((key) => ({
    id: id(), guardian_id: u.wali, student_id: st[key].id, relationship: "orang_tua", status: "verified", decided_by: u.admin,
    decided_at: at(key === "sinta" ? -25 : -61, 9), created_at: at(key === "sinta" ? -26 : -62, 19),
  })));

  await put(tx, "placement_attempts", [
    placementRow(st.raka.id, 24, ["A2", "B1", "A2", "A2", "A2"], refs),
    placementRow(st.sinta.id, 24, ["A2", "A2", "A1", "A2", "A1"], refs),
    placementRow(st.ahmad.id, 23, ["A1", "A2", "A1", "A1", "A2"], refs),
    placementRow(st.putri.id, 22, ["B1", "B1", "A2", "A2", "A2"], refs),
    placementRow(st.budi.id, 60, ["A2", "A2", "A2", "A2", "A1"], refs),
    placementRow(st.dewi.id, 60, ["A1", "A2", "A1", "A1", "A1"], refs),
    placementRow(st.eka.id, 2, ["A2", "A2", "A2", "A1", "A2"], refs),
  ]);

  // Batch: A berjalan (sesi 1–5 sudah lewat), B selesai, C buka pendaftaran.
  const batchDefs = {
    A: { code: "DEMO-SU-A", status: "running", offsets: [-15, -12, -8, -5, -1, 2, 6, 9], created: -30 },
    B: { code: "DEMO-SU-B", status: "completed", offsets: [-52, -49, -45, -42, -38, -35, -31, -28], created: -66 },
    C: { code: "DEMO-SU-C", status: "open", offsets: [10, 13, 17, 20, 24, 27, 31, 34], created: -4 },
  };
  const b = {};
  for (const [key, d] of Object.entries(batchDefs)) b[key] = { ...d, id: id(), sessions: d.offsets.map(() => id()) };
  await put(tx, "batches", Object.values(b).map((x) => ({
    id: x.id, code: x.code, program_id: program.id, tutor_id: u.tutor, start_date: dateOf(x.offsets[0]),
    schedule_label: `${dayName(x.offsets[0])} & ${dayName(x.offsets[1])}, 19.00–20.00 WIB`, meeting_url: "https://meet.google.com/demo-milestone",
    capacity: 6, status: x.status, notes: "Data contoh untuk uji coba.", created_by: u.admin, curriculum_id: curriculum.id, created_at: at(x.created, 10),
  })));
  const recorded = { A: 4, B: 8, C: 0 };
  await put(tx, "class_sessions", Object.entries(b).flatMap(([key, x]) => x.offsets.map((off, i) => ({
    id: x.sessions[i], batch_id: x.id, seq: i + 1, starts_at: at(off, 19), duration_minutes: 60, topic: modules[i].title, module_id: modules[i].id,
    tutor_note: i < recorded[key] && i % 2 === 0 ? "Siswa aktif bertanya; lanjutkan latihan follow-up question." : "",
    attendance_done_at: i < recorded[key] ? at(off, 20, 20) : null,
  }))));

  // Pendaftaran kelas dan invoice.
  const enrollDefs = [
    ["raka", "A", "active", -21, -20, -19],
    ["sinta", "A", "active", -21, -20, null],
    ["ahmad", "A", "active", -20, -19, -19],
    ["putri", "A", "active", -19, -18, -18],
    ["budi", "B", "completed", -57, -56, -55],
    ["dewi", "B", "completed", -57, -56, -56],
  ];
  const enr = {};
  const enrollments = enrollDefs.map(([key, batch, status, created, activated, onboarded]) => {
    enr[key] = id();
    return { id: enr[key], student_id: st[key].id, batch_id: b[batch].id, status, activated_at: at(activated, 13), onboarded_at: onboarded === null ? null : at(onboarded, 19), created_by: st[key].by, created_at: at(created, 20) };
  });
  enr.eka = id();
  enrollments.push({ id: enr.eka, student_id: st.eka.id, batch_id: b.C.id, status: "awaiting_verification", activated_at: null, onboarded_at: null, created_by: u.admin, created_at: hoursAgo(5) });
  await put(tx, "enrollments", enrollments);

  const numbers = (await tx`select nextval('public.invoice_number_seq')::int as v from generate_series(1, ${enrollments.length})`).map((r) => r.v);
  const invoices = enrollments.map((e, i) => {
    const key = Object.keys(enr).find((k) => enr[k] === e.id);
    const batch = Object.values(b).find((x) => x.id === e.batch_id);
    const paid = e.status !== "awaiting_verification";
    const yymm = new Date(Date.parse(e.created_at) + WIB).toISOString().slice(2, 7).replace("-", "");
    return {
      id: id(), number: `INV-${yymm}-${String(numbers[i]).padStart(4, "0")}`, enrollment_id: e.id, student_id: e.student_id, amount_idr: program.price_idr,
      description: `${program.name} · batch ${batch.code} · ${st[key].name}`, status: paid ? "paid" : "awaiting_verification",
      due_at: new Date(Date.parse(e.created_at) + 2 * DAY).toISOString(), reject_reason: null, paid_at: paid ? e.activated_at : null,
      verified_by: paid ? u.admin : null, created_by: e.created_by, created_at: e.created_at,
    };
  });
  await put(tx, "invoices", invoices);
  const ekaInvoice = invoices.at(-1).id;
  const proofPath = `${ekaInvoice}/bukti-transfer-contoh.pdf`;
  await put(tx, "payment_proofs", [{
    id: id(), invoice_id: ekaInvoice, file_path: proofPath, sender_bank: "BCA", sender_name: "Eka Saputra", transfer_date: dateOf(0),
    amount_idr: program.price_idr, status: "pending", reject_reason: null, uploaded_by: null, created_at: hoursAgo(2),
  }]);

  // Absensi: batch A sesi 1–4 (sesi 5 kemarin belum diisi tutor), batch B lengkap.
  const special = { A: { "2:sinta": ["late", "Terlambat 10 menit"], "3:ahmad": ["absent", "Tidak hadir tanpa kabar"], "4:putri": ["excused", "Sakit, sudah izin ke tutor"] }, B: { "3:dewi": ["late", "Sinyal putus di awal sesi"], "6:budi": ["excused", "Dinas luar kota"] } };
  const roster = { A: ["raka", "sinta", "ahmad", "putri"], B: ["budi", "dewi"] };
  await put(tx, "attendance", ["A", "B"].flatMap((key) => b[key].offsets.slice(0, recorded[key]).flatMap((off, i) => roster[key].map((who) => {
    const [status, note] = special[key][`${i + 1}:${who}`] ?? ["present", ""];
    return { session_id: b[key].sessions[i], student_id: st[who].id, status, note, recorded_by: u.tutor, recorded_at: at(off, 20, 20) };
  }))));

  // Tugas: batch A sesi 1–5 (tugas sesi 5 bertenggat besok), batch B sesi 1 dan 4.
  const tasks = [];
  const addTask = (key, seq) => {
    const off = b[key].offsets[seq - 1];
    const m = modules[seq - 1];
    const due = at(off + 2, 21);
    const task = { id: id(), key, seq, due, off };
    tasks.push(task);
    return {
      id: task.id, batch_id: b[key].id, session_id: b[key].sessions[seq - 1], module_task_id: m.task_id, title: m.task_title, instructions: m.instructions,
      submission_type: "any", due_at: due, reminder_sent_at: Date.parse(due) < Date.now() ? at(off + 1, 8) : null, created_by: u.tutor, created_at: at(off, 20, 30),
    };
  };
  await put(tx, "assignments", [1, 2, 3, 4, 5].map((s) => addTask("A", s)).concat([1, 4].map((s) => addTask("B", s))));
  const task = (key, seq) => tasks.find((t) => t.key === key && t.seq === seq);

  const ANSWERS = {
    1: "Hi, I'm %s. I live in Bandung and I work in an office near Dago. On weekends I like cycling with my friends and trying new coffee shops. I want to speak English more confidently at work.",
    2: "1. What do you usually do after work? 2. How did you start that hobby? 3. Which place do you recommend for a weekend trip? 4. What was the best part of it? 5. Would you go there again?",
    3: "A: The meeting is at half past two. B: Sorry, did you say two or half past two? A: Half past two. B: Got it, thank you for clarifying.",
    4: "Last year I went to Yogyakarta with my family. We missed the train, so we took a bus at night. It was tiring, but we saw the sunrise at Borobudur and it was amazing.",
    5: "In my opinion, working from home is good because we save time. However, I agree that meeting colleagues in person is also important for teamwork.",
  };
  const answer = (seq, who) => ANSWERS[seq].replace("%s", st[who].name.split(" ")[0]);
  const subs = [];
  const fbs = [];
  const submit = (t, who, { version = 1, at: when, status, late = false, text, feedback }) => {
    const subId = id();
    subs.push({ id: subId, assignment_id: t.id, student_id: st[who].id, version, text_answer: text ?? answer(t.seq, who), file_path: null, mime: null, is_late: late, status, submitted_by: who === "raka" ? u.siswa : ["sinta", "dewi"].includes(who) ? u.wali : null, submitted_at: when });
    if (feedback) fbs.push({ submission_id: subId, body: feedback[0], decision: status === "accepted" ? "accepted" : "revision", status: "published", tutor_id: u.tutor, published_at: feedback[1], created_at: feedback[1] });
  };
  const GOOD = "Bagus! Struktur jawabanmu jelas dan kosakatanya tepat. Pertahankan, dan coba tambahkan satu contoh pribadi di tugas berikutnya.";
  for (const [seq, who] of [[1, "raka"], [1, "sinta"], [1, "ahmad"], [1, "putri"], [2, "sinta"], [2, "ahmad"], [2, "putri"], [3, "raka"], [3, "sinta"], [4, "ahmad"]]) {
    const t = task("A", seq);
    submit(t, who, { at: at(t.off + 1, 20), status: "accepted", feedback: [GOOD, at(t.off + 2, 10)] });
  }
  const a2 = task("A", 2);
  submit(a2, "raka", { at: at(a2.off + 1, 21), status: "revision_requested", feedback: ["Pertanyaanmu sudah bagus, tetapi baru 3 yang benar-benar follow-up. Tambahkan 2 pertanyaan yang menanggapi jawaban lawan bicara, misalnya 'What made you…?'", at(a2.off + 2, 9)] });
  submit(a2, "raka", { version: 2, at: at(-1, 20, 30), status: "submitted", text: `${answer(2, "raka")} 6. What made you choose that place? 7. How did you feel when you got there?` });
  const a3 = task("A", 3);
  submit(a3, "ahmad", { at: at(-4, 19), status: "submitted", late: true });
  const a4 = task("A", 4);
  submit(a4, "raka", { at: at(a4.off + 2, 18), status: "submitted" });
  for (const seq of [1, 4]) {
    const t = task("B", seq);
    for (const who of ["budi", "dewi"]) submit(t, who, { at: at(t.off + 1, 20), status: "accepted", feedback: [GOOD, at(t.off + 2, 9)] });
  }
  await put(tx, "submissions", subs);
  await put(tx, "feedback", fbs);

  // Nilai assessment (skala 1–4 per indikator): batch A baru baseline (assessment tengah sesi 4 belum diisi tutor),
  // batch B lengkap.
  const scores = (values) => Object.fromEntries(indicators.map((ind, i) => [ind, values[i % values.length]]));
  const assessment = (key, who, kind, values, note) => {
    const off = b[key].offsets[point[kind] - 1];
    return { id: id(), batch_id: b[key].id, student_id: st[who].id, kind, scores: scores(values), note, status: "published", assessed_by: u.tutor, published_at: at(off + 1, 9), created_at: at(off, 21) };
  };
  await put(tx, "assessments", [
    assessment("A", "raka", "baseline", [2, 2, 3, 2, 2], "Sudah berani memulai percakapan; jawaban masih pendek."),
    assessment("A", "sinta", "baseline", [2, 1, 2, 2, 2], "Pemalu di awal, pemahaman cukup baik."),
    assessment("A", "ahmad", "baseline", [1, 2, 1, 2, 1], "Perlu banyak latihan pelafalan dan tata bahasa dasar."),
    assessment("A", "putri", "baseline", [3, 2, 3, 3, 2], "Lancar; perlu melatih pertanyaan lanjutan."),
    assessment("B", "budi", "baseline", [2, 2, 2, 2, 2], "Kosakata cukup, kelancaran perlu ditingkatkan."),
    assessment("B", "budi", "mid", [3, 2, 3, 2, 3], "Mulai mampu menjaga percakapan lebih lama."),
    assessment("B", "budi", "final", [3, 3, 3, 3, 3], "Percakapan 5 menit berjalan lancar dengan klarifikasi yang tepat."),
    assessment("B", "dewi", "baseline", [1, 2, 1, 2, 2], "Masih ragu berbicara dan sering diam."),
    assessment("B", "dewi", "mid", [2, 2, 2, 2, 2], "Lebih percaya diri, struktur kalimat membaik."),
    assessment("B", "dewi", "final", [3, 2, 3, 3, 2], "Mampu bertanya balik dan meminta klarifikasi dengan sopan."),
  ]);

  // Laporan Budi menunggu review Lead; laporan Dewi belum disusun tutor.
  await put(tx, "reports", [{
    id: id(), enrollment_id: enr.budi, student_id: st.budi.id, batch_id: b.B.id, status: "submitted",
    strengths: "Budi aktif bertanya balik dan mampu menjaga percakapan sekitar 5 menit tentang pekerjaan dan hobi.",
    improvements: "Perlu melatih bentuk lampau (past tense) dan memperluas kosakata untuk menyampaikan pendapat.",
    levels: { speaking: "B1", listening: "A2", grammar: "A2" }, recommended_program_ids: [nextProgram?.id ?? program.id],
    lead_comment: "", summary: null, pdf_path: null, tutor_id: u.tutor, submitted_at: at(b.B.offsets[7] + 2, 10), reviewed_by: null, published_at: null,
    return_count: 0, created_at: at(b.B.offsets[7] + 1, 20),
  }]);
  await put(tx, "tutor_surveys", [{ id: id(), enrollment_id: enr.budi, tutor_id: u.tutor, batch_id: b.B.id, rating: 5, comment: "Tutornya sabar dan sering memberi contoh percakapan nyata.", created_at: at(-26, 19) }]);
  await put(tx, "tutor_observations", [{
    id: id(), tutor_id: u.tutor, batch_id: b.A.id, observed_on: dateOf(b.A.offsets[2]), scores: { preparation: 3, engagement: 4, clarity: 3, feedback: 3, time: 4 },
    strengths: "Suasana kelas hidup; semua siswa mendapat giliran berbicara.", improvements: "Berikan koreksi pelafalan lebih spesifik di akhir aktivitas.",
    observed_by: u.lead, created_at: at(b.A.offsets[2], 21),
  }]);

  await put(tx, "expenses", [
    ["tutor_fee", "Honor tutor batch DEMO-SU-B", 1200000, -26],
    ["marketing", "Iklan Instagram SpeakUp", 350000, -14],
    ["tools", "Langganan aplikasi video meeting", 230000, -6],
    ["operational", "Paket internet kantor", 150000, -3],
  ].map(([category, description, amount, day]) => ({ id: id(), spent_on: dateOf(day), category, description, amount_idr: amount, receipt_path: null, created_by: u.owner, created_at: at(day, 15) })));

  const t1 = id();
  const t2 = id();
  await put(tx, "tickets", [
    { id: t1, requester_id: u.siswa, category: "class", subject: "Link kelas sesi 6 belum muncul", status: "open", closed_at: null, closed_by: null, last_message_at: hoursAgo(3), created_at: hoursAgo(3) },
    { id: t2, requester_id: u.wali, category: "payment", subject: "Minta kuitansi pembayaran Dewi", status: "answered", closed_at: null, closed_by: null, last_message_at: at(-1, 10), created_at: at(-2, 19) },
  ]);
  await put(tx, "ticket_messages", [
    { id: id(), ticket_id: t1, author_id: u.siswa, from_staff: false, body: "Halo kak, di halaman jadwal saya link untuk sesi 6 belum muncul. Apakah linknya sama dengan sesi sebelumnya?", created_at: hoursAgo(3) },
    { id: id(), ticket_id: t2, author_id: u.wali, from_staff: false, body: "Selamat malam, saya butuh kuitansi pembayaran kelas SpeakUp Dewi untuk arsip kantor. Bisa dibantu?", created_at: at(-2, 19) },
    { id: id(), ticket_id: t2, author_id: u.admin, from_staff: true, body: "Selamat pagi Bu Ratna, invoice yang sudah lunas bisa dilihat di menu Pembayaran. Bila perlu kuitansi bercap, kami kirimkan lewat email hari ini.", created_at: at(-1, 10) },
  ]);

  return proofPath;
}

// ---------------------------------------------------------------------------
// Hapus data contoh: akun demo, batch DEMO-*, siswa terkait, dan semua yang dibuat lewat akun demo.
// ---------------------------------------------------------------------------

// Penghapusan aman diulang utuh: setiap percobaan mencari ulang data contoh yang tersisa.
export const hapus = (ctx) => withRetry(() => hapusOnce(ctx));

async function hapusOnce(ctx) {
  const { sql } = ctx;
  const demo = (await sql`select id from auth.users where raw_app_meta_data ->> 'demo' = 'true'`).map((r) => r.id);
  // Staf yang ditambahkan Owner demo selama uji coba ikut dihapus (akun yang lebih lama dari data contoh tidak).
  const added = (await sql`
    select p.id from public.profiles p
    where p.created_at >= (select min(created_at) from public.profiles where id = any(${demo}::uuid[]))
      and not (p.id = any(${demo}::uuid[]))
      and exists (select 1 from public.user_roles r where r.user_id = p.id and r.granted_by = any(${demo}::uuid[]))`).map((r) => r.id);
  const users = [...demo, ...added];
  const files = await sql.begin(async (tx) => {
    const list = async (q) => (await q).map((r) => r.id);
    const batches = await list(tx`select id from public.batches where code like 'DEMO-%' or tutor_id = any(${users}::uuid[]) or created_by = any(${users}::uuid[])`);
    const students = await list(tx`
      select id from public.students
      where user_id = any(${users}::uuid[]) or created_by = any(${users}::uuid[])
         or id in (select student_id from public.guardian_links where guardian_id = any(${users}::uuid[]))
         or id in (select student_id from public.enrollments where batch_id = any(${batches}::uuid[]))`);
    const invoices = await list(tx`select id from public.invoices where student_id = any(${students}::uuid[]) or enrollment_id in (select id from public.enrollments where batch_id = any(${batches}::uuid[]))`);
    const attempts = await list(tx`select id from public.placement_attempts where student_id = any(${students}::uuid[])`);
    const assignments = await list(tx`select id from public.assignments where batch_id = any(${batches}::uuid[])`);
    const reportFiles = (await tx`select pdf_path from public.reports where (student_id = any(${students}::uuid[]) or batch_id = any(${batches}::uuid[])) and pdf_path is not null`).map((r) => r.pdf_path);
    const receipts = (await tx`select receipt_path from public.expenses where created_by = any(${users}::uuid[]) and receipt_path is not null`).map((r) => r.receipt_path);

    // Semua id yang mungkin muncul di audit log dan log notifikasi.
    const entityIds = (await tx`
      select x::text as id from unnest(${[...users, ...batches, ...students, ...invoices, ...attempts, ...assignments]}::uuid[]) x
      union select id::text from public.enrollments where batch_id = any(${batches}::uuid[]) or student_id = any(${students}::uuid[])
      union select id::text from public.class_sessions where batch_id = any(${batches}::uuid[])
      union select id::text from public.submissions where assignment_id = any(${assignments}::uuid[]) or student_id = any(${students}::uuid[])
      union select id::text from public.assessments where batch_id = any(${batches}::uuid[]) or student_id = any(${students}::uuid[])
      union select id::text from public.reports where batch_id = any(${batches}::uuid[]) or student_id = any(${students}::uuid[])
      union select id::text from public.payment_proofs where invoice_id = any(${invoices}::uuid[])
      union select id::text from public.tickets where requester_id = any(${users}::uuid[])
      union select id::text from public.expenses where created_by = any(${users}::uuid[])
      union select id::text from public.tutor_observations where observed_by = any(${users}::uuid[]) or batch_id = any(${batches}::uuid[])`).map((r) => r.id);

    await tx`delete from public.notifications where recipient_id = any(${users}::uuid[]) or entity_id = any(${entityIds}::text[])`;
    // Notifikasi portal untuk akun lain (misalnya Owner asli) tentang data contoh ikut dihapus.
    const [{ inbox }] = await tx`select to_regclass('public.inbox') is not null as inbox`;
    if (inbox) await tx`delete from public.inbox where recipient_id = any(${users}::uuid[]) or entity_id = any(${entityIds}::text[])`;
    await tx`delete from public.tickets where requester_id = any(${users}::uuid[])`;
    await tx`delete from public.expenses where created_by = any(${users}::uuid[])`;
    await tx`delete from public.tutor_observations where observed_by = any(${users}::uuid[]) or batch_id = any(${batches}::uuid[])`;
    await tx`delete from public.enrollments where batch_id = any(${batches}::uuid[]) or student_id = any(${students}::uuid[])`;
    await tx`delete from public.students where id = any(${students}::uuid[])`;
    await tx`delete from public.batches where id = any(${batches}::uuid[])`;

    // Kurikulum: draf versi baru buatan akun demo dihapus; versi yang diterbitkan akun demo kembali menjadi draf.
    await tx`
      delete from public.curricula c where c.created_by = any(${users}::uuid[]) and c.status = 'draft'
        and not exists (select 1 from public.batches b where b.curriculum_id = c.id)`;
    await tx`
      update public.curricula c set status = 'draft', published_at = null, published_by = null
      where c.published_by = any(${users}::uuid[]) and c.status = 'published'
        and not exists (select 1 from public.batches b where b.curriculum_id = c.id)
        and not exists (select 1 from public.curricula d where d.program_id = c.program_id and d.status = 'draft')`;

    // Rujukan lain ke akun demo (misalnya konten website yang diubah lewat akun demo) dilepas; isinya tetap.
    const refs = await tx`
      select c.conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype in ('a', 'r') and not a.attnotnull`;
    await tx`delete from public.audit_log where actor_id = any(${users}::uuid[])`;
    for (const r of refs) await tx.unsafe(`update ${r.tbl} set ${r.col} = null where ${r.col} = any($1::uuid[])`, [users]);
    await tx`delete from auth.users where id = any(${users}::uuid[])`;
    // Terakhir, karena penghapusan di atas ikut menulis audit (misalnya role dicabut).
    await tx`delete from public.audit_log where entity_id = any(${entityIds}::text[])`;

    return { batches, students, invoices, attempts, assignments, reportFiles, receipts };
  });

  // File di storage dihapus setelah data di database bersih.
  const { list, remove } = ctx.storage;
  const inFolder = async (bucket, folder) => (await list(bucket, folder)).map((name) => `${folder}/${name}`);
  for (const inv of files.invoices) await remove("payment-proofs", await inFolder("payment-proofs", inv));
  for (const att of files.attempts) await remove("placement-answers", await inFolder("placement-answers", att));
  for (const a of files.assignments) {
    for (const folder of await inFolder("assignment-files", a)) await remove("assignment-files", await inFolder("assignment-files", folder));
  }
  await remove("report-files", files.reportFiles);
  await remove("expense-receipts", files.receipts);
  return { users: users.length, batches: files.batches.length, students: files.students.length };
}

// ---------------------------------------------------------------------------
// Perintah npm run demo:isi / demo:hapus / demo:password
// ---------------------------------------------------------------------------

// Daftar akun dan password ditampilkan sekali di terminal dan disimpan di e2e-output/ (tidak ikut Git).
const ACCOUNTS_FILE = new URL("../e2e-output/akun-demo.txt", import.meta.url);

function showAccounts(password, accounts) {
  const lines = [
    "Akun demo Milestone English (data contoh uji coba). Semua akun memakai password yang sama.",
    `Password: ${password}`,
    "",
    ...accounts.map((a) => `${a.label.padEnd(30)} ${a.email}`),
    "",
    "Siswa/wali masuk di http://localhost:3000/masuk, tim di http://localhost:3000/tim. Panduan: docs/UJI-COBA.md",
  ];
  mkdirSync(new URL(".", ACCOUNTS_FILE), { recursive: true });
  writeFileSync(ACCOUNTS_FILE, `${lines.join("\n")}\n`);
  console.log(`\n${lines.map((l) => `  ${l}`).join("\n")}`);
  console.log(`\nDaftar ini juga tersimpan di ${fileURLToPath(ACCOUNTS_FILE)}`);
}

// Error koneksi (misalnya ETIMEDOUT) kadang tanpa pesan; kodenya ditampilkan supaya penyebabnya terbaca.
function describe(e) {
  const inner = e.errors?.map((x) => x.message).filter(Boolean) ?? [];
  return e.message || [e.code, ...inner].filter(Boolean).join(": ") || String(e);
}

async function main() {
  const [mode, emailArg] = process.argv.slice(2);
  const baseEmail = emailArg?.trim().toLowerCase();
  if (!["isi", "hapus", "password"].includes(mode) || (baseEmail && !/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(baseEmail))) {
    console.error("Pemakaian: npm run demo:isi [-- email@gmail.com], npm run demo:hapus, atau npm run demo:password");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || (mode !== "password" && !process.env.SUPABASE_DB_URL)) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SUPABASE_DB_URL harus diisi di .env.local.");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Panggilan Storage diulang bila koneksi ke Supabase putus sesaat ("fetch failed").
  const retry = async (label, fn) => {
    for (let i = 1; ; i++) {
      let result;
      try {
        result = await fn();
      } catch (e) {
        result = { error: e };
      }
      if (!result.error) return result.data;
      if (i >= 4) throw new Error(`Gagal ${label}: ${describe(result.error)}`);
      await sleep(1000 * i);
    }
  };

  // Mengganti password semua akun demo tanpa mengubah datanya. Hanya lewat HTTPS (Supabase Auth),
  // sehingga tetap jalan di jaringan yang memblokir koneksi langsung ke database.
  if (mode === "password") {
    try {
      const demoUsers = [];
      for (let page = 1; ; page++) {
        const data = await retry("membaca daftar akun", () => admin.auth.admin.listUsers({ page, perPage: 1000 }));
        demoUsers.push(...data.users.filter((x) => x.app_metadata?.demo === true));
        if (data.users.length < 1000) break;
      }
      if (!demoUsers.length) throw new Error("Belum ada akun demo. Jalankan npm run demo:isi dulu.");
      const password = generatePassword();
      for (const x of demoUsers) await retry(`mengganti password ${x.email}`, () => admin.auth.admin.updateUserById(x.id, { password }));
      const keyOf = (email) => email.match(/demo-([a-z]+)@/)?.[1];
      const accounts = ACCOUNTS.map((a) => ({ ...a, email: demoUsers.find((x) => keyOf(x.email) === a.key)?.email })).filter((a) => a.email);
      console.log("Password semua akun demo sudah diganti. Data contoh tidak berubah.");
      showAccounts(password, accounts);
    } catch (e) {
      console.error(`Gagal mengganti password akun demo: ${describe(e)}`);
      console.error("Jalankan perintah yang sama lagi; semua akun demo akan mendapat password baru yang sama.");
      process.exitCode = 1;
    }
    return;
  }

  const sql = postgres(process.env.SUPABASE_DB_URL, { ssl: "require", max: 1, onnotice: () => {} });
  const ctx = {
    sql,
    // Gangguan jaringan sesaat ke Supabase Auth dicoba ulang.
    async createAccount(account, email, password) {
      for (let i = 1; ; i++) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: account.name, ...account.meta },
          app_metadata: appMetadata(account),
        });
        if (!error) return data.user.id;
        const transient = error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500 || error.status === 0;
        if (!transient || i >= 4) throw new Error(`Gagal membuat akun ${email}: ${error.message}`);
        await sleep(500 * i);
      }
    },
    storage: {
      upload: (bucket, path, body, contentType) => retry(`mengunggah ${path}`, () => admin.storage.from(bucket).upload(path, body, { contentType, upsert: true })),
      list: async (bucket, folder) => ((await retry(`membaca ${bucket}/${folder}`, () => admin.storage.from(bucket).list(folder, { limit: 1000 }))) ?? []).map((f) => f.name),
      remove: async (bucket, paths) => {
        if (paths.length) await retry(`menghapus file di ${bucket}`, () => admin.storage.from(bucket).remove(paths));
      },
    },
  };

  try {
    if (mode === "isi") {
      console.log("Mengisi data contoh...");
      const { password, accounts } = await isi(ctx, { baseEmail });
      console.log("\nData contoh siap.");
      showAccounts(password, accounts);
      console.log("Setelah selesai, hapus semua data contoh: npm run demo:hapus");
    } else {
      const n = await hapus(ctx);
      console.log(`Data contoh dihapus: ${n.users} akun demo, ${n.batches} batch, ${n.students} siswa, beserta tugas, nilai, laporan, tiket, pengeluaran, dan file terkait.`);
      console.log("Perubahan konten lewat akun demo (teks website, harga, soal placement, isi kurikulum) tidak dikembalikan; periksa sebelum rilis.");
    }
  } catch (e) {
    console.error(`${mode === "isi" ? "Gagal mengisi" : "Gagal menghapus"} data contoh: ${describe(e)}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
