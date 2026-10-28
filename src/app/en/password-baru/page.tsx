import type { Metadata } from "next";
import { NewPasswordView } from "@/app/password-baru/view";

export const metadata: Metadata = { title: "Create a new password" };
export const dynamic = "force-dynamic";

export default function EnglishNewPasswordPage() {
  return <NewPasswordView lang="en" />;
}
