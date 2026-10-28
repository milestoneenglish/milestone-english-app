import type { Metadata } from "next";
import { RegisterView } from "@/app/daftar/view";

export const metadata: Metadata = { title: "Sign up", alternates: { languages: { id: "/daftar", en: "/en/daftar" } } };

export default function EnglishRegisterPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  return <RegisterView lang="en" searchParams={searchParams} />;
}
