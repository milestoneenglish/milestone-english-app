"use client";

import { useState } from "react";
import {
  createStaffAction,
  deleteExpenseAction,
  prepareReceiptUpload,
  receiptUrlAction,
  resetStaffPasswordAction,
  saveExpenseAction,
  saveProgramAction,
  setStaffActiveAction,
  updateStaffAction,
} from "@/app/portal/ops-actions";
import { EXPENSE_CATEGORIES, EXPENSE_LABEL, PROGRAM_CATEGORIES, PROGRAM_STATUS, primaryRole, rolesFrom, STAFF_ROLES, type ExpenseCategory, type StaffRole } from "@/lib/ops";
import { ROLE_LABEL } from "@/lib/roles";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "../modal";
import { danger, ErrorText, Field, ghost, useAction } from "./curriculum-forms";

// ---------------------------------------------------------------------------
// Staf dan role
// ---------------------------------------------------------------------------

const ROLE_HINT: Record<StaffRole, string> = {
  owner: "Semua menu, termasuk keuangan dan staf",
  admin: "Pendaftaran, batch, pembayaran, bantuan, CMS",
  lead: "Kurikulum, placement, review laporan, kualitas tutor",
  tutor: "Kelas, absensi, tugas, assessment, laporan",
};

function RolePicker({ value, onChange, label }: { value: StaffRole[]; onChange: (v: StaffRole[]) => void; label: string }) {
  const [initial] = useState(value);
  const primary = primaryRole(value);
  const teaches = value.includes("tutor") && primary !== "tutor";
  // Kombinasi lama di luar pola "role utama + tutor" dilepas saat disimpan; beri tahu Owner sebelumnya.
  const dropped = initial.filter((r) => !rolesFrom(primaryRole(initial), initial.includes("tutor")).includes(r));
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-bold text-amber-100">{label}</legend>
      <select value={primary} onChange={(e) => onChange(rolesFrom(e.target.value as StaffRole, teaches))} className="field" required aria-label="Role utama">
        <option value="">Pilih role utama</option>
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {primary && <p className="text-xs text-amber-200/70">{ROLE_HINT[primary]}</p>}
      {primary && primary !== "tutor" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange/20 p-3 text-sm has-[:checked]:border-orange">
          <input type="checkbox" className="mt-1 accent-orange-500" checked={teaches} onChange={(e) => onChange(rolesFrom(primary, e.target.checked))} />
          <span>
            <span className="block font-bold text-white">Juga mengajar sebagai tutor</span>
            <span className="block text-xs text-amber-200/70">Menu Tutor ikut tampil; pindah role dari menu kiri atas setelah masuk.</span>
          </span>
        </label>
      )}
      {dropped.length > 0 && <p className="text-xs font-bold text-amber-200">Role lain ({dropped.map((r) => ROLE_LABEL[r]).join(", ")}) akan dilepas saat disimpan.</p>}
    </fieldset>
  );
}

function PasswordField({ value, onChange, label, hint }: { value: string; onChange: (v: string) => void; label: string; hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="field pr-24" required minLength={8} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-orange">
          {show ? "Sembunyikan" : "Tampilkan"}
        </button>
      </div>
    </Field>
  );
}

export function StaffCreateForm() {
  const { pending, error, act, router } = useAction();
  const empty = { fullName: "", email: "", phone: "", password: "", roles: [] as StaffRole[] };
  const [f, setF] = useState(empty);
  const [created, setCreated] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setCreated("");
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(
          () => createStaffAction(f),
          () => {
            setCreated(f.email);
            setF(empty);
            router.refresh();
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nama lengkap">
          <input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} className="field" required />
        </Field>
        <Field label="Email login">
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="field" required />
        </Field>
        <Field label="No. WhatsApp (opsional)" hint="Untuk notifikasi WhatsApp.">
          <input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" className="field" />
        </Field>
      </div>
      <PasswordField value={f.password} onChange={(v) => set("password", v)} label="Password awal" hint="Minimal 8 karakter, berisi huruf dan angka. Sampaikan ke staf; ia wajib menggantinya saat pertama masuk." />
      <RolePicker value={f.roles} onChange={(v) => set("roles", v)} label="Role" />
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Menyimpan..." : "Tambah staf"}
        </button>
        {created && <span className="text-sm font-bold text-emerald-300">Akun {created} dibuat. Sampaikan email dan password awalnya ke staf.</span>}
      </div>
    </form>
  );
}

export function StaffEditor({ staff }: { staff: { id: string; full_name: string; phone: string | null; roles: StaffRole[]; status: "active" | "inactive"; liveBatches: number } }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState({ fullName: staff.full_name, phone: staff.phone ?? "", roles: staff.roles });
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const done = (text: string) => () => {
    setMsg(text);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          act(() => updateStaffAction(staff.id, f), done("Data staf tersimpan"), "Data staf tersimpan");
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap">
            <input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className="field" required />
          </Field>
          <Field label="No. WhatsApp">
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" className="field" />
          </Field>
        </div>
        <RolePicker value={f.roles} onChange={(roles) => setF({ ...f, roles })} label={`Role ${staff.full_name}`} />
        <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
          Simpan data & role
        </button>
      </form>

      <form
        className="space-y-3 border-t border-orange/15 pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          act(
            () => resetStaffPasswordAction(staff.id, password),
            () => {
              setPassword("");
              done("Password diganti. Staf wajib membuat password baru saat masuk.")();
            },
          );
        }}
      >
        <PasswordField value={password} onChange={setPassword} label="Password baru" hint="Untuk staf yang lupa password. Staf wajib menggantinya saat masuk berikutnya." />
        <button disabled={pending} className={ghost}>
          Ganti password
        </button>
      </form>

      <div className="space-y-3 border-t border-orange/15 pt-5">
        {staff.status === "active" ? (
          confirm ? (
            <div className="space-y-3 rounded-xl border border-rose-400/40 p-4">
              <p className="text-sm text-amber-100">Staf yang dinonaktifkan langsung keluar dan tidak bisa masuk lagi sampai diaktifkan kembali. Datanya tetap tersimpan.</p>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => act(() => setStaffActiveAction(staff.id, false), done("Staf dinonaktifkan"), "Staf dinonaktifkan")} className={danger}>
                  Ya, nonaktifkan
                </button>
                <button type="button" onClick={() => setConfirm(false)} className={ghost}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} disabled={staff.liveBatches > 0} className={danger}>
              Nonaktifkan staf
            </button>
          )
        ) : (
          <button type="button" disabled={pending} onClick={() => act(() => setStaffActiveAction(staff.id, true), done("Staf diaktifkan kembali"), "Staf diaktifkan kembali")} className={ghost}>
            Aktifkan kembali
          </button>
        )}
        {staff.liveBatches > 0 && staff.status === "active" && (
          <p className="text-xs text-amber-200/80">Masih memegang {staff.liveBatches} batch yang belum selesai. Pindahkan batch ke tutor lain dari menu Admin sebelum menonaktifkan.</p>
        )}
      </div>
      <ErrorText error={error} />
      {msg && !error && <p className="text-sm font-bold text-emerald-300">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Program dan harga
// ---------------------------------------------------------------------------

export type ProgramFormValue = {
  code: string;
  name: string;
  category: string;
  entry_level: string;
  duration_label: string;
  capacity: number;
  price_idr: number;
  outcome: string;
  evidence: string;
  featured: boolean;
  status: "draft" | "active" | "archived";
  sort_order: number;
};

export function ProgramForm({ id, initial }: { id: string | null; initial: ProgramFormValue }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof ProgramFormValue>(k: K, v: ProgramFormValue[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  const priceChanged = id !== null && f.price_idr !== initial.price_idr;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(
          () => saveProgramAction(id, f),
          () => {
            setSaved(true);
            if (!id) setF(initial);
            router.refresh();
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-4">
        {!id && (
          <Field label="Kode" hint="2–4 huruf, misalnya SU.">
            <input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={4} className="field" required />
          </Field>
        )}
        <Field label="Nama program">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} className="field" required />
        </Field>
        <Field label="Kategori">
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className="field" required>
            <option value="">Pilih kategori</option>
            {PROGRAM_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={(e) => set("status", e.target.value as ProgramFormValue["status"])} className="field">
            {Object.entries(PROGRAM_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Harga (Rp)">
          <input type="number" min={0} step={1} value={f.price_idr} onChange={(e) => set("price_idr", Number(e.target.value))} className="field" required />
        </Field>
        <Field label="Durasi">
          <input value={f.duration_label} onChange={(e) => set("duration_label", e.target.value)} placeholder="4 minggu (8 × 60 mnt)" className="field" required />
        </Field>
        <Field label="Level masuk">
          <input value={f.entry_level} onChange={(e) => set("entry_level", e.target.value)} className="field" required />
        </Field>
        <Field label="Kapasitas per batch">
          <input type="number" min={1} max={30} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} className="field" required />
        </Field>
      </div>
      <Field label="Target program (outcome)">
        <textarea value={f.outcome} onChange={(e) => set("outcome", e.target.value)} rows={2} className="field" required />
      </Field>
      <Field label="Bukti hasil belajar">
        <textarea value={f.evidence} onChange={(e) => set("evidence", e.target.value)} rows={2} className="field" required />
      </Field>
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm text-amber-100">
          <input type="checkbox" className="accent-orange-500" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Tampilkan sebagai program unggulan
        </label>
        <label className="flex items-center gap-2 text-sm text-amber-100">
          Urutan
          <input type="number" value={f.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className="field w-20" />
        </label>
      </div>
      {priceChanged && <p className="text-xs font-bold text-amber-200">Harga baru berlaku untuk invoice yang dibuat setelah disimpan. Invoice yang sudah ada tetap memakai harga lama.</p>}
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Menyimpan..." : id ? "Simpan program" : "Tambah program"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Keuangan
// ---------------------------------------------------------------------------

export function ExpenseForm({ id, initial, today }: { id: string | null; initial?: { spentOn: string; category: ExpenseCategory; description: string; amount: number; hasReceipt: boolean }; today: string }) {
  const { pending, error, act, router } = useAction();
  const blank = { spentOn: today, category: "" as ExpenseCategory | "", description: "", amount: 0 };
  const [f, setF] = useState(initial ? { spentOn: initial.spentOn, category: initial.category, description: initial.description, amount: initial.amount } : blank);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setUploadError("");
        setSaved(false);
        let receiptPath: string | undefined;
        if (file) {
          setStep("Mengunggah nota...");
          const target = await prepareReceiptUpload(file.type, file.size);
          if (!target.ok) {
            setStep("");
            return setUploadError(target.error);
          }
          const up = await createClient().storage.from("expense-receipts").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
          setStep("");
          if (up.error) return setUploadError("Nota gagal diunggah. Periksa koneksi lalu coba lagi.");
          receiptPath = target.path;
        }
        act(
          () => saveExpenseAction(id, { spentOn: f.spentOn, category: f.category, description: f.description, amount: f.amount, receiptPath }),
          () => {
            setSaved(true);
            setFile(null);
            if (!id) setF(blank);
            router.refresh();
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Tanggal">
          <input type="date" value={f.spentOn} max={today} onChange={(e) => setF({ ...f, spentOn: e.target.value })} className="field" required />
        </Field>
        <Field label="Kategori">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })} className="field" required>
            <option value="">Pilih kategori</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nominal (Rp)">
          <input type="number" min={1} step={1} value={f.amount || ""} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} className="field" required />
        </Field>
        <Field label={initial?.hasReceipt ? "Ganti foto nota" : "Foto nota (opsional)"}>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="field text-xs" />
        </Field>
      </div>
      <Field label="Keterangan">
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Contoh: Honor tutor batch SU-2611 (8 sesi)" className="field" required />
      </Field>
      <ErrorText error={uploadError || error} />
      <div className="flex items-center gap-3">
        <button disabled={pending || Boolean(step)} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {step || (pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Catat pengeluaran")}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

export function ExpenseActions({ id, hasReceipt }: { id: string; hasReceipt: boolean }) {
  const { pending, error, act } = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {hasReceipt && (
        <button type="button" disabled={pending} onClick={() => act(() => receiptUrlAction(id), (res) => "url" in res && window.open(res.url, "_blank", "noopener,noreferrer"), false)} className={ghost}>
          Nota
        </button>
      )}
      {confirm ? (
        <>
          <button type="button" disabled={pending} onClick={() => act(() => deleteExpenseAction(id), undefined, "Dihapus")} className={danger}>
            Ya, hapus
          </button>
          <button type="button" onClick={() => setConfirm(false)} className={ghost}>
            Batal
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className={danger}>
          Hapus
        </button>
      )}
      <ErrorText error={error} />
    </span>
  );
}

export function StaffCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-orange rounded-full px-5 py-2.5 text-sm">
        + Tambah staf
      </button>
      {open && (
        <Modal title="Tambah staf" onClose={() => setOpen(false)} wide>
          <StaffCreateForm />
        </Modal>
      )}
    </>
  );
}

export function StaffEditButton({ staff }: { staff: Parameters<typeof StaffEditor>[0]["staff"] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-orange/40 px-4 py-1.5 text-xs font-black text-orange hover:bg-orange/10">
        Ubah
      </button>
      {open && (
        <Modal title={`Ubah ${staff.full_name}`} onClose={() => setOpen(false)} wide>
          <StaffEditor staff={staff} />
        </Modal>
      )}
    </>
  );
}
