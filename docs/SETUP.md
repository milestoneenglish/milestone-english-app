# Panduan setup Milestone English

Panduan ini menyambungkan aplikasi ke Supabase supaya login dan database aktif. Waktu yang dibutuhkan sekitar 20 menit. Kunci rahasia hanya kamu yang memasukkan; jangan dikirim lewat chat.

## 1. Buat proyek Supabase

1. Buka [supabase.com](https://supabase.com), masuk, lalu klik **New project**.
2. Isi nama `milestone-english`, buat password database (simpan baik-baik), pilih region **Southeast Asia (Singapore)**.
3. Tunggu sampai proyek siap.

## 2. Pasang database

1. Di dashboard Supabase, buka **SQL Editor** lalu **New query**.
2. Salin seluruh isi `supabase/migrations/20261026000001_foundation.sql`, tempel, klik **Run**.
3. Buat query baru, salin seluruh isi `supabase/seed.sql`, tempel, klik **Run**. Ini mengisi 12 program, FAQ, dan pengaturan awal.

## 3. Atur login kode email

1. Buka **Authentication > Sign In / Providers > Email**:
   - Pastikan **Email** aktif.
   - **Email OTP Expiration**: `600` (10 menit).
   - **Email OTP Length**: `6`.
2. Buka **Authentication > Email Templates > Magic Link**:
   - Subject: `Kode masuk Milestone English`
   - Body: salin isi `supabase/templates/kode-masuk.html`.
3. Buka **Authentication > URL Configuration**, isi **Site URL** dengan `http://localhost:3100` untuk sekarang. Setelah deploy, ganti dengan domain kamu.

Catatan: email bawaan Supabase dibatasi beberapa email per jam dan hanya cocok untuk uji coba. Sebelum dipakai siswa, sambungkan Resend di **Project Settings > Authentication > SMTP Settings** (dikerjakan bersama di Fase 2).

## 4. Isi kunci di laptop

1. Di folder proyek, salin `.env.example` menjadi `.env.local`.
2. Dari **Project Settings > API**, isi:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (rahasia)

## 5. Buat akun Owner pertama

Jalankan di terminal folder proyek, ganti dengan email dan nama kamu:

```bash
npm run setup:owner -- emailkamu@domain.com "Nama Kamu"
```

## 6. Jalankan dan coba

```bash
npm run dev -- -p 3100
```

Buka `http://localhost:3100`. Landing page sekarang membaca data dari Supabase (tanda "Mode pratinjau" hilang). Klik **Masuk**, masukkan email Owner, ketik kode dari email, dan kamu masuk ke portal Owner.

## Perintah lain

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Menjalankan tes database dan keamanan |
| `npm run check` | Cek tipe, lint, dan tes sekaligus |
| `npm run seed:generate` | Membuat ulang `supabase/seed.sql` dari `src/data/catalog.ts` |
