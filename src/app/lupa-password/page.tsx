import type { Metadata } from "next";
import { ForgotView } from "./view";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ untuk?: string }> }) {
  return <ForgotView lang="id" searchParams={searchParams} />;
}
