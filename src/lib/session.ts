import { redirect } from "next/navigation";
import { cache } from "react";
import { isRole, ROLE_PRIORITY, type Role } from "./roles";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";
import { currentUser } from "./supabase/user";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
};

// Pengguna yang sedang masuk beserta role aktifnya. Mengalihkan ke /masuk jika tidak ada sesi.
export const requireViewer = cache(async (): Promise<Viewer> => {
  if (!isSupabaseConfigured) redirect("/masuk");
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/masuk");

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, status, must_change_password").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/masuk?status=nonaktif");
  }

  // Akun dengan password sementara harus membuat password pribadi dulu.
  if (profile.must_change_password) redirect("/password-baru");

  const roles = ROLE_PRIORITY.filter((r) => (roleRows ?? []).some((row) => isRole(row.role) && row.role === r));

  return { id: user.id, email: profile.email, fullName: profile.full_name, roles };
});

// Pengguna yang memegang salah satu role yang diminta; selain itu dikembalikan ke portal.
export async function requireRole(...allowed: Role[]): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.roles.some((r) => allowed.includes(r))) redirect("/portal");
  return viewer;
}
