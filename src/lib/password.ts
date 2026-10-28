import { dict, type Lang } from "@/lib/i18n";

// Aturan password: minimal 8 karakter, berisi huruf dan angka.
// Atur juga hal yang sama di Supabase (lihat docs/SETUP.md) supaya ditegakkan di server.
export const PASSWORD_RULE = dict("id").password.rule;

export function passwordProblem(password: string, lang: Lang = "id"): string | null {
  const t = dict(lang).password;
  if (password.length < 8) return t.short;
  if (password.length > 72) return t.long;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return t.mix;
  return null;
}
