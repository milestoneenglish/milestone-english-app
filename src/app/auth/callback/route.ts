import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Tujuan link dari email (verifikasi akun, lupa password). Mendukung link bawaan
// Supabase (?code=) dan link berbasis token (?token_hash=&type=).
// `next` menentukan halaman tujuan; hanya path di dalam aplikasi yang diterima.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : type === "recovery" ? "/password-baru" : "/portal";

  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/masuk", origin));
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/masuk?galat=link", origin));
}
