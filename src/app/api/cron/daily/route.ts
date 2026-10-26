import { NextResponse } from "next/server";
import { releaseExpired } from "@/lib/classes";
import { sendDueReminders } from "@/lib/learning";
import { ensureReportPdfs, sendAcademicReminders } from "@/lib/reports";

// Dijalankan Vercel Cron sekali sehari (vercel.json): melepas invoice kedaluwarsa, memperbarui
// status batch, mengirim pengingat tugas H-1, mengingatkan staf akademik atas assessment/laporan
// yang lewat batas, dan membuat ulang PDF laporan yang sempat gagal. Vercel menyertakan
// CRON_SECRET sebagai Bearer token.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await releaseExpired();
  const reminders = await sendDueReminders();
  const academic = await sendAcademicReminders();
  const pdfs = await ensureReportPdfs();
  return NextResponse.json({ ok: true, reminders, academic, pdfs });
}
