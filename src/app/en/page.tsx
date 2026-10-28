import type { Metadata } from "next";
import { LandingView } from "@/components/landing/landing-page";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Milestone English | Outcome-Based English Learning with Measurable Progress" },
  description: "12 English programs with small classes of 4–6 learners, a free placement test, clear rubrics, and measurable progress reports.",
  alternates: { canonical: "/en", languages: { id: "/", en: "/en" } },
  openGraph: { locale: "en_GB" },
};

export default function EnglishLandingPage() {
  return <LandingView lang="en" />;
}
