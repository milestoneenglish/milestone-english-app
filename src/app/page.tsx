import type { Metadata } from "next";
import { LandingView } from "@/components/landing/landing-page";

export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: "/", languages: { id: "/", en: "/en" } } };

export default function LandingPage() {
  return <LandingView lang="id" />;
}
