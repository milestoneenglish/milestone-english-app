import "server-only";
import { ClassError, dbError } from "@/lib/classes";
import { BUCKETS, fileExists, fileExtension, removeFiles, signedDownload, signedUpload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Kurikulum berversi milik Academic Lead. Perubahan memakai sesi pengguna sehingga
// RLS dan fungsi database memeriksa role serta mengunci struktur versi yang sudah terbit.

export type SubmissionType = "text" | "audio" | "file" | "any";
export const SUBMISSION_LABEL: Record<SubmissionType, string> = { text: "Teks", audio: "Rekaman suara", file: "File", any: "Teks, rekaman, atau file" };

export type MaterialRow = { id: string; module_id: string; kind: "file" | "link" | "audio"; title: string; url: string | null; file_path: string | null; mime: string | null; size_bytes: number | null };
export type TaskRow = { id: string; module_id: string; title: string; instructions: string; submission_type: SubmissionType; sort_order: number };
export type ModuleRow = { id: string; curriculum_id: string; seq: number; week: number; title: string; objectives: string; content: string; materials: MaterialRow[]; tasks: TaskRow[] };
export type CurriculumRow = {
  id: string;
  program_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  title: string;
  notes: string;
  published_at: string | null;
  updated_at: string;
};

const CURRICULUM_COLUMNS = "id, program_id, version, status, title, notes, published_at, updated_at";
const MATERIAL_COLUMNS = "id, module_id, kind, title, url, file_path, mime, size_bytes";

export type CurriculumSummary = CurriculumRow & { modules: number; batches: number };

// Semua program aktif beserta versi kurikulumnya, terbaru lebih dulu.
export async function curriculumOverview() {
  const admin = createAdminClient();
  const [{ data: programs }, { data: curricula }, { data: modules }, { data: batches }] = await Promise.all([
    admin.from("programs").select("id, code, name, category, duration_label").eq("status", "active").order("sort_order"),
    admin.from("curricula").select(CURRICULUM_COLUMNS).order("version", { ascending: false }),
    admin.from("curriculum_modules").select("curriculum_id"),
    admin.from("batches").select("curriculum_id").not("curriculum_id", "is", null).neq("status", "cancelled"),
  ]);
  return (programs ?? []).map((p) => ({
    program: p,
    versions: ((curricula ?? []) as CurriculumRow[])
      .filter((c) => c.program_id === p.id)
      .map((c) => ({
        ...c,
        modules: (modules ?? []).filter((m) => m.curriculum_id === c.id).length,
        batches: (batches ?? []).filter((b) => b.curriculum_id === c.id).length,
      })),
  }));
}

async function modulesWithContent(moduleIds: string[] | null, curriculumId?: string): Promise<ModuleRow[]> {
  const admin = createAdminClient();
  let q = admin.from("curriculum_modules").select("id, curriculum_id, seq, week, title, objectives, content").order("seq");
  if (curriculumId) q = q.eq("curriculum_id", curriculumId);
  if (moduleIds) q = q.in("id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: modules } = await q;
  const ids = (modules ?? []).map((m) => m.id);
  if (!ids.length) return [];
  const [{ data: materials }, { data: tasks }] = await Promise.all([
    admin.from("module_materials").select(MATERIAL_COLUMNS).in("module_id", ids).order("sort_order").order("created_at"),
    admin.from("module_tasks").select("id, module_id, title, instructions, submission_type, sort_order").in("module_id", ids).order("sort_order").order("created_at"),
  ]);
  return (modules ?? []).map((m) => ({
    ...m,
    materials: ((materials ?? []) as MaterialRow[]).filter((x) => x.module_id === m.id),
    tasks: ((tasks ?? []) as TaskRow[]).filter((x) => x.module_id === m.id),
  }));
}

export const modulesById = (ids: string[]) => modulesWithContent(ids);

export async function getCurriculum(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("curricula").select(`${CURRICULUM_COLUMNS}, program:programs(id, code, name, duration_label)`).eq("id", id).maybeSingle();
  if (!data) return null;
  const [modules, { count }, { data: siblings }] = await Promise.all([
    modulesWithContent(null, id),
    admin.from("batches").select("id", { count: "exact", head: true }).eq("curriculum_id", id).neq("status", "cancelled"),
    admin.from("curricula").select("id, version, status").eq("program_id", data.program_id).order("version"),
  ]);
  return {
    curriculum: data as unknown as CurriculumRow & { program: { id: string; code: string; name: string; duration_label: string } },
    modules,
    batches: count ?? 0,
    hasDraft: (siblings ?? []).some((s) => s.status === "draft"),
  };
}

// Kurikulum terbit (termasuk arsip) untuk dipilih Admin saat membuka batch.
export async function publishedCurricula() {
  const admin = createAdminClient();
  const [{ data }, { data: modules }] = await Promise.all([
    admin.from("curricula").select("id, program_id, version, status, title").in("status", ["published", "archived"]).order("version", { ascending: false }),
    admin.from("curriculum_modules").select("curriculum_id"),
  ]);
  return (data ?? []).map((c) => ({ ...c, modules: (modules ?? []).filter((m) => m.curriculum_id === c.id).length })) as {
    id: string;
    program_id: string;
    version: number;
    status: "published" | "archived";
    title: string;
    modules: number;
  }[];
}

async function rpc(fn: string, args: Record<string, unknown>, fallback: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) dbError(error, fallback);
  return data;
}

async function audit(actorId: string, action: string, entity: string, entityId: string, detail: object = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId, detail });
}

export async function createCurriculum(programId: string) {
  const { data: program } = await createAdminClient().from("programs").select("name").eq("id", programId).maybeSingle();
  if (!program) throw new ClassError("Program tidak ditemukan.");
  return (await rpc("create_curriculum", { p_program: programId, p_title: `Kurikulum ${program.name}` }, "Kurikulum gagal dibuat.")) as string;
}

export async function updateCurriculumMeta(actorId: string, id: string, input: { title: string; notes: string }) {
  const title = input.title.trim();
  if (title.length < 3) throw new ClassError("Judul kurikulum minimal 3 karakter.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("curricula").update({ title: title.slice(0, 160), notes: input.notes.trim().slice(0, 2000) }).eq("id", id).select("id");
  if (error) dbError(error, "Kurikulum gagal disimpan.");
  if (!data?.length) throw new ClassError("Kurikulum tidak ditemukan atau kamu tidak punya akses.");
  await audit(actorId, "curriculum_updated", "curricula", id);
}

export type ModuleInput = { title: string; objectives: string; content: string; week: number };

export async function updateModule(actorId: string, moduleId: string, input: ModuleInput) {
  const title = input.title.trim();
  if (title.length < 2) throw new ClassError("Judul modul wajib diisi.");
  if (!Number.isInteger(input.week) || input.week < 1 || input.week > 52) throw new ClassError("Minggu 1–52.");
  const supabase = await createClient();
  const { data: current } = await supabase.from("curriculum_modules").select("week").eq("id", moduleId).maybeSingle();
  if (!current) throw new ClassError("Modul tidak ditemukan.");
  // Kolom minggu hanya dikirim bila berubah, supaya isi versi terbit tetap bisa disimpan.
  const patch: Record<string, unknown> = { title: title.slice(0, 200), objectives: input.objectives.trim().slice(0, 2000), content: input.content.trim().slice(0, 20000) };
  if (input.week !== current.week) patch.week = input.week;
  const { data, error } = await supabase.from("curriculum_modules").update(patch).eq("id", moduleId).select("curriculum_id");
  if (error) dbError(error, "Modul gagal disimpan.");
  if (!data?.length) throw new ClassError("Modul tidak ditemukan atau kamu tidak punya akses.");
  await audit(actorId, "curriculum_module_updated", "curriculum_modules", moduleId);
}

export const addModule = async (curriculumId: string, title: string) => {
  if (title.trim().length < 2) throw new ClassError("Judul modul wajib diisi.");
  return (await rpc("add_curriculum_module", { p_curriculum: curriculumId, p_title: title }, "Modul gagal ditambahkan.")) as string;
};
export const moveModule = (moduleId: string, delta: number) => rpc("move_curriculum_module", { p_module: moduleId, p_delta: delta < 0 ? -1 : 1 }, "Urutan gagal diubah.");
export const deleteModule = (moduleId: string) => rpc("delete_curriculum_module", { p_module: moduleId }, "Modul gagal dihapus.");
export const publishCurriculum = (id: string) => rpc("publish_curriculum", { p_id: id }, "Kurikulum gagal diterbitkan.");
export const newCurriculumVersion = async (id: string) => (await rpc("new_curriculum_version", { p_id: id }, "Versi baru gagal dibuat.")) as string;

export async function deleteCurriculumDraft(id: string) {
  const admin = createAdminClient();
  const { data: mods } = await admin.from("curriculum_modules").select("id").eq("curriculum_id", id);
  const { data: files } = mods?.length ? await admin.from("module_materials").select("file_path").in("module_id", mods.map((m) => m.id)).not("file_path", "is", null) : { data: [] };
  const { data: program } = await admin.from("curricula").select("program_id").eq("id", id).maybeSingle();
  await rpc("delete_curriculum_draft", { p_id: id }, "Draf gagal dihapus.");
  await removeOrphans((files ?? []).map((f) => f.file_path as string));
  return program?.program_id as string | undefined;
}

// File materi dipakai bersama oleh versi hasil salinan; hanya dihapus bila tidak dirujuk lagi.
async function removeOrphans(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;
  const { data } = await createAdminClient().from("module_materials").select("file_path").in("file_path", unique);
  const used = new Set((data ?? []).map((r) => r.file_path));
  await removeFiles("materials", unique.filter((p) => !used.has(p)));
}

// ---------------------------------------------------------------------------
// Materi dan template tugas
// ---------------------------------------------------------------------------

export async function materialUploadTarget(moduleId: string, mime: string, size: number) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_edit_curriculum");
  if (!allowed) throw new ClassError("Hanya Academic Lead yang dapat mengunggah materi.");
  const { data: mod } = await createAdminClient().from("curriculum_modules").select("curriculum_id").eq("id", moduleId).maybeSingle();
  if (!mod) throw new ClassError("Modul tidak ditemukan.");
  const ext = fileExtension("materials", mime);
  if (!ext) throw new ClassError("Unggah PDF, Word, PowerPoint, gambar, atau audio (MP3, M4A, WAV).");
  if (size > BUCKETS.materials.maxBytes) throw new ClassError("Ukuran file maksimal 10 MB. Untuk video, tambahkan sebagai link.");
  const path = `${mod.curriculum_id}/${moduleId}/${Date.now()}.${ext}`;
  const token = await signedUpload("materials", path);
  if (!token) throw new ClassError("File gagal disiapkan untuk diunggah.");
  return { path, token };
}

export type MaterialInput = { kind: "file" | "link" | "audio"; title: string; url?: string; path?: string; mime?: string; size?: number };

export async function addMaterial(actorId: string, moduleId: string, input: MaterialInput) {
  const title = input.title.trim();
  if (title.length < 2) throw new ClassError("Beri judul materi.");
  const row: Record<string, unknown> = { module_id: moduleId, kind: input.kind, title: title.slice(0, 160), created_by: actorId };
  if (input.kind === "link") {
    const url = (input.url ?? "").trim();
    if (!/^https:\/\/\S+$/.test(url)) throw new ClassError("Link harus diawali https://, misalnya link YouTube atau Google Slides.");
    row.url = url.slice(0, 500);
  } else {
    const path = input.path ?? "";
    const { data: mod } = await createAdminClient().from("curriculum_modules").select("curriculum_id").eq("id", moduleId).maybeSingle();
    if (!mod || !path.startsWith(`${mod.curriculum_id}/${moduleId}/`) || !(await fileExists("materials", path))) throw new ClassError("File belum terunggah.");
    row.file_path = path;
    row.mime = input.mime ?? null;
    row.size_bytes = input.size || null;
    row.kind = input.mime?.startsWith("audio/") ? "audio" : "file";
  }
  const supabase = await createClient();
  const { error } = await supabase.from("module_materials").insert(row);
  if (error) dbError(error, "Materi gagal disimpan.");
}

export async function deleteMaterial(materialId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("module_materials").delete().eq("id", materialId).select("file_path");
  if (error) dbError(error, "Materi gagal dihapus.");
  if (!data?.length) throw new ClassError("Materi tidak ditemukan atau kamu tidak punya akses.");
  await removeOrphans(data.map((d) => d.file_path).filter(Boolean) as string[]);
}

export type TaskInput = { title: string; instructions: string; type: SubmissionType };

function cleanTask(input: TaskInput) {
  const title = input.title.trim();
  const instructions = input.instructions.trim();
  if (title.length < 2) throw new ClassError("Judul tugas wajib diisi.");
  if (instructions.length < 5) throw new ClassError("Tulis instruksi tugas.");
  if (!["text", "audio", "file", "any"].includes(input.type)) throw new ClassError("Jenis pengumpulan tidak valid.");
  return { title: title.slice(0, 160), instructions: instructions.slice(0, 4000), submission_type: input.type };
}

export async function saveTask(moduleId: string, taskId: string | null, input: TaskInput) {
  const supabase = await createClient();
  const row = cleanTask(input);
  const { data, error } = taskId
    ? await supabase.from("module_tasks").update(row).eq("id", taskId).select("id")
    : await supabase.from("module_tasks").insert({ ...row, module_id: moduleId }).select("id");
  if (error) dbError(error, "Tugas gagal disimpan.");
  if (!data?.length) throw new ClassError("Tugas tidak ditemukan atau kamu tidak punya akses.");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("module_tasks").delete().eq("id", taskId).select("id");
  if (error) dbError(error, "Tugas gagal dihapus.");
  if (!data?.length) throw new ClassError("Tugas tidak ditemukan atau kamu tidak punya akses.");
}

// ---------------------------------------------------------------------------
// Akses file materi: staf akademik/operasional, tutor batch yang memakai kurikulumnya,
// dan siswa/wali yang terdaftar (aktif atau selesai) di batch tersebut.
// ---------------------------------------------------------------------------

export async function materialFileUrl(viewer: { id: string; roles: string[] }, materialId: string) {
  const admin = createAdminClient();
  const { data: mat } = await admin.from("module_materials").select("file_path, title, module:curriculum_modules(curriculum_id)").eq("id", materialId).maybeSingle();
  if (!mat?.file_path) return null;
  const curriculumId = (mat.module as unknown as { curriculum_id: string }).curriculum_id;
  let allowed = viewer.roles.some((r) => r === "lead" || r === "owner" || r === "admin");
  if (!allowed) {
    const { data: batches } = await admin.from("batches").select("id, tutor_id").eq("curriculum_id", curriculumId);
    const ids = (batches ?? []).map((b) => b.id);
    allowed = (batches ?? []).some((b) => b.tutor_id === viewer.id && viewer.roles.includes("tutor"));
    if (!allowed && ids.length) {
      const supabase = await createClient();
      const { data: enrolled } = await supabase.from("enrollments").select("id").in("batch_id", ids).in("status", ["active", "completed"]).limit(1);
      allowed = Boolean(enrolled?.length);
    }
  }
  if (!allowed) return null;
  return signedDownload("materials", mat.file_path);
}
