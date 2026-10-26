import { NextResponse } from "next/server";
import { releaseExpired } from "@/lib/classes";
import { sendDueReminders } from "@/lib/learning";

// Dijalankan Vercel Cron sekali sehari (vercel.json): melepas invoice kedaluwarsa, memperbarui
// status batch, dan mengirim pengingat tugas H-1. Vercel menyertakan CRON_SECRET sebagai Bearer token.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await releaseExpired();
  const reminders = await sendDueReminders();
  return NextResponse.json({ ok: true, reminders });
}
