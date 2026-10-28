import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/user";

// Memperbarui sesi Supabase di setiap permintaan dan menjaga halaman portal.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const user = await currentUser(supabase);

  if (!user && request.nextUrl.pathname.startsWith("/portal")) {
    const url = request.nextUrl.clone();
    // Portal tim kembali ke pintu masuk tim; selain itu ke pintu masuk siswa dan wali.
    url.pathname = /^\/portal\/(owner|admin|lead|tutor)(\/|$)/.test(request.nextUrl.pathname) ? "/tim" : "/masuk";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
