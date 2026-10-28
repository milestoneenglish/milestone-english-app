import type { Metadata } from "next";
import { ForgotView } from "@/app/lupa-password/view";

export const metadata: Metadata = { title: "Forgot password" };

export default function EnglishForgotPasswordPage({ searchParams }: { searchParams: Promise<{ untuk?: string }> }) {
  return <ForgotView lang="en" searchParams={searchParams} />;
}
