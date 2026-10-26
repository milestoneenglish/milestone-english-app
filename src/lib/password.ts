// Aturan password: minimal 8 karakter, berisi huruf dan angka.
// Atur juga hal yang sama di Supabase (lihat docs/SETUP.md) supaya ditegakkan di server.
export const PASSWORD_RULE = "Minimal 8 karakter, berisi huruf dan angka.";

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password minimal 8 karakter.";
  if (password.length > 72) return "Password maksimal 72 karakter.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password harus berisi huruf dan angka.";
  return null;
}
