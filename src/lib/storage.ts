import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Bucket privat untuk materi kurikulum, file tugas, dan PDF laporan. File hanya dibuka lewat signed URL
// setelah server memeriksa hak akses.

const AUDIO: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm" };
const DOCS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const BUCKETS = {
  materials: { name: "learning-materials", types: { ...DOCS, ...AUDIO }, maxBytes: 10 * 1024 * 1024 },
  submissions: { name: "assignment-files", types: { ...DOCS, ...AUDIO }, maxBytes: 10 * 1024 * 1024 },
  reports: { name: "report-files", types: { "application/pdf": "pdf" }, maxBytes: 10 * 1024 * 1024 },
} as const;

export type BucketKey = keyof typeof BUCKETS;

export function isAudio(mime: string | null | undefined) {
  return Boolean(mime && mime.split(";")[0] in AUDIO);
}

// Ekstensi file untuk tipe yang diizinkan, atau null bila tipe/ukuran tidak cocok.
export function fileExtension(bucket: BucketKey, mime: string) {
  return (BUCKETS[bucket].types as Record<string, string>)[mime.split(";")[0]] ?? null;
}

async function ensureBucket(bucket: BucketKey) {
  const b = BUCKETS[bucket];
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(b.name);
  if (!data) await admin.storage.createBucket(b.name, { public: false, fileSizeLimit: "10MB", allowedMimeTypes: Object.keys(b.types) });
}

export async function signedUpload(bucket: BucketKey, path: string) {
  await ensureBucket(bucket);
  const { data, error } = await createAdminClient().storage.from(BUCKETS[bucket].name).createSignedUploadUrl(path);
  return error || !data ? null : data.token;
}

export async function fileExists(bucket: BucketKey, path: string) {
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data } = await createAdminClient().storage.from(BUCKETS[bucket].name).list(folder);
  return Boolean(data?.some((f) => `${folder}/${f.name}` === path));
}

export async function signedDownload(bucket: BucketKey, path: string, download?: string) {
  const { data } = await createAdminClient().storage.from(BUCKETS[bucket].name).createSignedUrl(path, 600, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}

export async function uploadFile(bucket: BucketKey, path: string, body: Buffer | Uint8Array, contentType: string) {
  await ensureBucket(bucket);
  const { error } = await createAdminClient().storage.from(BUCKETS[bucket].name).upload(path, body, { contentType, upsert: true });
  return !error;
}

export async function removeFiles(bucket: BucketKey, paths: string[]) {
  if (paths.length) await createAdminClient().storage.from(BUCKETS[bucket].name).remove(paths);
}
