import type { Metadata } from "next";
import { LoginView } from "@/app/masuk/view";

export const metadata: Metadata = { title: "Log in", alternates: { languages: { id: "/masuk", en: "/en/masuk" } } };

export default function EnglishLoginPage({ searchParams }: { searchParams: Promise<{ galat?: string; status?: string }> }) {
  return <LoginView lang="en" searchParams={searchParams} />;
}
