import type { Metadata } from "next";
import { RegisterView } from "./view";

export const metadata: Metadata = { title: "Daftar", alternates: { languages: { id: "/daftar", en: "/en/daftar" } } };

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  return <RegisterView lang="id" searchParams={searchParams} />;
}
