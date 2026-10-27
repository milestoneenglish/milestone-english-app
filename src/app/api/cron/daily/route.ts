import { NextResponse } from "next/server";
import { releaseExpired } from "@/lib/classes";
import { sendDueReminders } from "@/lib/learning";
import { notify, roleRecipients } from "@/lib/notify";
import { backupDue, markBackupReminded } from "@/lib/owner";
import { ensureReportPdfs, sendAcademicReminders } from "@/lib/reports";

// Dijalankan Vercel Cron sekali sehari (vercel.json): melepas invoice kedaluwarsa, memperbarui
// status batch, mengirim pengingat tugas H-1, mengingatkan staf akademik atas assessment/laporan
// yang lewat batas, membuat ulang PDF laporan yang sempat gagal, dan mengingatkan Owner bila
// backup terakhir lebih dari 30 hari. Vercel menyertakan CRON_SECRET sebagai Bearer token.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DATE_FMT = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await releaseExpired();
  const reminders = await sendDueReminders();
  const academic = await sendAcademicReminders();
  const pdfs = await ensureReportPdfs();
  const backup = await backupDue();
  if (backup.due) {
    await notify("backup_reminder", await roleRecipients("owner"), { last: backup.value.last_at ? DATE_FMT.format(new Date(backup.value.last_at)) : "belum pernah" });
    await markBackupReminded(backup.value);
  }
  return NextResponse.json({ ok: true, reminders, academic, pdfs, backupReminder: backup.due });
}
