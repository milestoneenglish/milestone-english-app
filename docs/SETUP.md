# Panduan setup Milestone English

Panduan ini menyambungkan aplikasi ke Supabase supaya login dan database aktif. Waktu yang dibutuhkan sekitar 20 menit. Kunci rahasia hanya kamu yang memasukkan; jangan dikirim lewat chat.

## 1. Buat proyek Supabase

1. Buka [supabase.com](https://supabase.com), masuk, lalu klik **New project**.
2. Isi nama `milestone-english`, buat password database (simpan baik-baik), pilih region **Southeast Asia (Singapore)**.
3. Tunggu sampai proyek siap.

## 2. Pasang database

1. Di dashboard Supabase, buka **SQL Editor** lalu **New query**.
2. Salin seluruh isi `supabase/migrations/20261026000001_foundation.sql`, tempel, klik **Run**.
3. Buat query baru, salin seluruh isi `supabase/migrations/20261026000002_password_login.sql`, tempel, klik **Run**.
4. Buat query baru, salin seluruh isi `supabase/seed.sql`, tempel, klik **Run**. Ini mengisi 12 program, FAQ, dan pengaturan awal.

Jalankan file migrasi sesuai urutan nomornya. Setiap ada file migrasi baru di folder `supabase/migrations`, jalankan file itu saja.

## 3. Atur login

Login memakai email dan password. Email hanya dipakai untuk verifikasi akun baru dan lupa password.

1. Buka **Authentication > Sign In / Providers > Email**:
   - Pastikan **Email** aktif dan **Confirm email** menyala.
   - **Minimum password length**: `8`.
   - **Password requirements**: pilih huruf dan angka (*Letters and digits*).
2. Buka **Authentication > URL Configuration**:
   - **Site URL**: `http://localhost:3100` untuk sekarang. Setelah deploy, ganti dengan domain kamu.
   - **Redirect URLs**: tambahkan `http://localhost:3100/**`. Setelah deploy, tambahkan juga `https://domainkamu.com/**`.

Selama belum memakai SMTP sendiri, template email dikunci Supabase dan berbahasa Inggris. Email verifikasi dan lupa password berisi link; aplikasi menerimanya lewat `/auth/callback`. Batasannya:

- Email bawaan hanya terkirim ke alamat anggota tim di akun Supabase, dan hanya beberapa email per jam.
- Buka link di browser yang sama dengan tempat kamu memintanya.

Setelah domain dan Resend siap (Fase 2), sambungkan SMTP di **Authentication > Emails > SMTP Settings**, lalu template email bisa diganti ke bahasa Indonesia dengan tampilan Milestone English.

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

Terminal menampilkan **password sementara**. Pakai untuk masuk pertama kali; kamu langsung diminta membuat password pribadi.

## 6. Jalankan dan coba

```bash
npm run dev -- -p 3100
```

Buka `http://localhost:3100`. Landing page sekarang membaca data dari Supabase (tanda "Mode pratinjau" hilang). Klik **Masuk**, masukkan email Owner dan password sementara dari langkah 5. Kamu akan diminta membuat password pribadi, lalu masuk ke portal Owner.

## Perintah lain

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Menjalankan tes database dan keamanan |
| `npm run check` | Cek tipe, lint, dan tes sekaligus |
| `npm run seed:generate` | Membuat ulang `supabase/seed.sql` dari `src/data/catalog.ts` |
