import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Tujuan link dari email (verifikasi akun, lupa password). Mendukung link bawaan
// Supabase (?code=) dan link berbasis token (?token_hash=&type=).
// `next` menentukan halaman tujuan; hanya path di dalam aplikasi yang diterima.
// Template email mengirim alamat asal permintaan ({{ .RedirectTo }}) sebagai redirect_to; tujuan "next" diambil dari
// sana sehingga link reset dari halaman English kembali ke halaman English. Hanya alamat situs sendiri yang dipakai.
function nextFromRedirect(redirectTo: string | null, origin: string) {
  if (!redirectTo) return "";
  try {
    const url = new URL(redirectTo, origin);
    return url.origin === origin ? (url.searchParams.get("next") ?? "") : "";
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? nextFromRedirect(searchParams.get("redirect_to"), origin);
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : type === "recovery" ? "/password-baru" : "/portal";

  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/masuk", origin));
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  // Link dari halaman English kembali ke halaman masuk English bila gagal.
  const failed = next.startsWith("/en/") ? "/en/masuk?galat=link" : "/masuk?galat=link";
  return NextResponse.redirect(new URL(ok ? next : failed, origin));
}
