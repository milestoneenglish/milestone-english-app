import type { Metadata } from "next";
import { LoginView } from "./view";

export const metadata: Metadata = { title: "Masuk", alternates: { languages: { id: "/masuk", en: "/en/masuk" } } };

// Pintu masuk siswa dan wali (ditautkan dari landing page). Tim Milestone masuk lewat /tim.
export default function LoginPage({ searchParams }: { searchParams: Promise<{ galat?: string; status?: string }> }) {
  return <LoginView lang="id" searchParams={searchParams} />;
}
