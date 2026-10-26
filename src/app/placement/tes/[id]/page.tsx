import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { TestRunner } from "@/components/placement/test-runner";
import { getPaper, loadAttempt, PlacementError } from "@/lib/placement/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Placement Test" };
export const dynamic = "force-dynamic";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const paper = await getPaper(id);
    const attempt = await loadAttempt(id);
    let takerName: string | undefined;
    if (attempt?.student_id) {
      const { data } = await createAdminClient().from("students").select("full_name").eq("id", attempt.student_id).single();
      takerName = data?.full_name;
    }
    return <TestRunner paper={paper} takerName={takerName} />;
  } catch (e) {
    if (!(e instanceof PlacementError)) throw e;
    return (
      <AuthShell kicker="Placement test" title="Tes tidak bisa dibuka" intro={e.message}>
        <p className="lp-muted text-sm">Tes hanya bisa dibuka oleh pemiliknya, dari akun atau browser yang dipakai saat memulai.</p>
        <Link href="/placement" className="btn-orange mt-6 inline-block rounded-xl px-6 py-3 text-sm">
          Kembali
        </Link>
      </AuthShell>
    );
  }
}
