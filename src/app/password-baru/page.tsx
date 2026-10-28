import type { Metadata } from "next";
import { NewPasswordView } from "./view";

export const metadata: Metadata = { title: "Buat password baru" };
export const dynamic = "force-dynamic";

export default function NewPasswordPage() {
  return <NewPasswordView lang="id" />;
}
