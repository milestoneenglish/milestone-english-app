"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { useState, useTransition } from "react";
import { decideGuardianLink } from "@/app/portal/admin-actions";

export function DecideButtons({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const decide = (d: "verified" | "rejected") =>
    start(async () => {
      const res = await decideGuardianLink(linkId, d);
      if (!res.ok) { toast.error(res.error); setError(res.error); }
      else { toast.success("Keputusan tersimpan"); router.refresh(); }
    });
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs font-bold text-rose-300">{error}</span>}
      <button disabled={pending} onClick={() => decide("rejected")} className="rounded-full border border-rose-400/50 px-4 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/10">
        Tolak
      </button>
      <button disabled={pending} onClick={() => decide("verified")} className="btn-orange rounded-full px-4 py-2 text-xs">
        Verifikasi
      </button>
    </div>
  );
}
