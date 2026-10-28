import "server-only";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Link email bawaan Supabase (konfirmasi akun dan reset password) dikirim lewat SMTP yang diatur di Supabase,
// bukan lewat Resend. Saklarnya satu: "Confirm email" di Supabase. Saat menyala, SMTP dianggap sudah disambungkan
// dan halaman lupa password memakai link email; saat mati, password diatur ulang oleh admin/Owner.
export async function authEmailEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY }, next: { revalidate: 60 } });
    if (!res.ok) return false;
    const settings = (await res.json()) as { mailer_autoconfirm?: boolean };
    return settings.mailer_autoconfirm === false;
  } catch {
    return false;
  }
}
