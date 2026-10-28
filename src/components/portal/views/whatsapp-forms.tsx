"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logWhatsappAction, resetLearnerPasswordAction } from "@/app/portal/admin-actions";
import { WhatsappIcon } from "@/components/icons";
import { toast } from "@/components/toast";
import type { WaKind } from "@/lib/whatsapp";
import { Modal } from "../modal";
import { ghost } from "./curriculum-forms";

export const waUrl = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(text)}`;

// Membuka WhatsApp admin dengan pesan terisi, lalu mencatatnya sebagai sudah dikabari.
export function WhatsappSendButton({ kind, entityId, recipientId, phone, text, label }: { kind: WaKind; entityId: string; recipientId: string; phone: string; text: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        // Jendela dibuka langsung saat diklik supaya tidak diblokir browser.
        window.open(waUrl(phone, text), "_blank", "noopener,noreferrer");
        start(async () => {
          const res = await logWhatsappAction({ kind, entityId, recipientId, phone, text });
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Ditandai sudah dikabari: ${label}`);
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-1.5 text-xs font-black text-[#062B16] hover:brightness-110 disabled:opacity-60"
    >
      <WhatsappIcon className="h-4 w-4" /> {label}
    </button>
  );
}

// Admin membuat password sementara untuk siswa/wali yang lupa password, lalu mengirimkannya lewat WhatsApp.
export function ResetPasswordButton({ userId, label }: { userId: string; label: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ password: string; name: string; email: string; phone: string | null } | null>(null);
  const close = () => (setConfirm(false), setResult(null));

  const text = result
    ? `Halo ${result.name}, ini password sementara akun portal Milestone English kamu:\n\nEmail: ${result.email}\nPassword: ${result.password}\n\nMasuk di ${window.location.origin}/masuk, lalu buat password baru yang hanya kamu ketahui.`
    : "";

  return (
    <>
      <button onClick={() => setConfirm(true)} className={ghost}>
        {label}
      </button>
      {(confirm || result) && (
        <Modal title={result ? "Password sementara dibuat" : "Buat password sementara?"} onClose={close}>
          {!result ? (
            <div className="space-y-4 text-sm text-amber-100">
              <p>Password lama tidak berlaku lagi. Pengguna wajib membuat password baru saat masuk dengan password sementara ini.</p>
              <p className="text-xs text-slate-400">Pastikan permintaan ini benar dari pemilik akun, misalnya dengan menanyakan nama dan email lewat WhatsApp terdaftar.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await resetLearnerPasswordAction(userId);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Password sementara dibuat");
                      setResult(res);
                    })
                  }
                  className="btn-orange rounded-full px-5 py-2.5 text-sm"
                >
                  {pending ? "Membuat..." : "Ya, buat password sementara"}
                </button>
                <button onClick={close} className={ghost}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-amber-100">
              <p>
                Untuk <span className="font-bold text-white">{result.name}</span> ({result.email}). Password ini hanya tampil sekali.
              </p>
              <p className="rounded-xl border border-orange/50 bg-orange/10 px-4 py-3 text-center font-mono text-xl font-black tracking-wider text-white">{result.password}</p>
              <div className="flex flex-wrap gap-2">
                {result.phone ? (
                  <a
                    href={waUrl(result.phone, text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-xs font-black text-[#062B16]"
                  >
                    <WhatsappIcon className="h-4 w-4" /> Kirim via WhatsApp
                  </a>
                ) : (
                  <p className="text-xs text-slate-400">Nomor WhatsApp akun ini belum diisi; salin password lalu kirim manual.</p>
                )}
                <button onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Pesan disalin"))} className={ghost}>
                  Salin pesan
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
