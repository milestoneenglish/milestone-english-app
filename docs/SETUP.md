# Panduan setup Milestone English

Panduan ini menyambungkan aplikasi ke Supabase supaya login dan database aktif. Waktu yang dibutuhkan sekitar 20 menit. Kunci rahasia hanya kamu yang memasukkan; jangan dikirim lewat chat.

## 1. Buat proyek Supabase

1. Buka [supabase.com](https://supabase.com), masuk, lalu klik **New project**.
2. Isi nama `milestone-english`, buat password database (simpan baik-baik), pilih region **Southeast Asia (Singapore)**.
3. Tunggu sampai proyek siap.

## 2. Pasang database

Cara termudah: biarkan skrip yang memasang semua migrasi.

1. Di Supabase klik **Connect** → tab **Connection String** → pilih **Session pooler**, salin URI-nya.
2. Tambahkan ke `.env.local` (ganti `[YOUR-PASSWORD]` dengan password database proyek):

   ```
   SUPABASE_DB_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

3. Jalankan:

   ```bash
   npm run db:migrate
   ```

Skrip memasang migrasi yang belum ada (urut sesuai nomor file di `supabase/migrations`), mengisi data awal tanpa menimpa data yang sudah ada, dan membuat bucket storage privat untuk rekaman placement dan bukti bayar. Aman dijalankan berulang setiap ada pembaruan.

Tanpa `SUPABASE_DB_URL`, kamu juga bisa menempel isi setiap file migrasi lalu `supabase/seed.sql` di **SQL Editor** secara berurutan.

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

## 7. Pembayaran dan notifikasi (Fase 2)

1. Masuk sebagai Owner, buka **Pengaturan**, lalu isi rekening tujuan transfer. Rekening ini tampil di halaman pembayaran siswa.
2. Notifikasi email dan WhatsApp sudah tersambung ke setiap langkah: placement diterima dan terbit, invoice terbit, bukti dikirim, pembayaran diverifikasi atau ditolak, tutor ditugaskan. Selama kunci di bawah kosong, pesan hanya **dicatat** (status "Belum dikirim") dan bisa diperiksa di **Pengaturan** Owner dan beranda Admin.
3. Saat siap mengirim sungguhan, isi di `.env.local` (dan di Vercel saat deploy):

   | Kunci | Dari mana |
   | --- | --- |
   | `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys, setelah domain diverifikasi |
   | `EMAIL_FROM` | Alamat pengirim di domain itu, misalnya `Milestone English <halo@domainanda.com>` |
   | `FONNTE_TOKEN` | [fonnte.com](https://fonnte.com) → Device → token nomor WhatsApp bisnis |
   | `NEXT_PUBLIC_SITE_URL` | Alamat aplikasi, misalnya `https://domainanda.com` (untuk link di pesan) |

   Tidak ada perubahan kode yang dibutuhkan; pesan berikutnya langsung terkirim.

Aturan pembayaran: kursi dipegang 2x24 jam sejak invoice terbit. Lewat batas, invoice kedaluwarsa dan kursi kembali tersedia. Bila bukti ditolak, siswa mendapat waktu minimal 24 jam lagi untuk mengunggah ulang.

## 8. Kurikulum, absensi, dan tugas (Fase 3)

1. Masuk sebagai Academic Lead, buka **Kurikulum**. Draf kurikulum 12 program sudah terisi (satu sesi satu modul, masing-masing dengan tujuan, poin materi, dan satu template tugas). Tinjau, lengkapi materi (file, audio, atau link), lalu **Terbitkan**.
2. Isi sesi, materi, dan tugas tetap bisa diubah setelah terbit dan langsung terlihat di batch yang memakainya. Untuk mengubah jumlah atau urutan sesi, pakai **Buat versi baru**; batch yang sudah berjalan tetap memakai versi lamanya.
3. Admin memilih kurikulum saat membuat batch. Jumlah sesi batch mengikuti jumlah modul.
4. Status batch berganti sendiri: **Berjalan** sejak sesi pertama dimulai, **Selesai** setelah sesi terakhir berakhir. Siswa di batch yang selesai bisa membaca materi dan feedback, tetapi tidak bisa mengumpulkan tugas lagi.
5. Pengingat tugas H-1 dikirim oleh jadwal harian Vercel (`vercel.json`, pukul 08.00 WIB). Tambahkan `CRON_SECRET` (string acak panjang) di Environment Variables Vercel; tanpa itu jadwal ditolak.

Aturan tugas: tenggat default sebelum sesi berikutnya; pengumpulan terlambat tetap diterima dengan tanda Terlambat; revisi maksimal 2 kali; feedback tutor tertulis dan bisa disimpan sebagai draf sebelum diterbitkan. Anak yang didaftarkan wali (tanpa akun sendiri) mengumpulkan tugas lewat akun wali yang sudah diverifikasi.

## 9. Assessment, progres, dan laporan (Fase 4)

1. Setiap kurikulum punya **rubrik** 4–6 indikator dengan skor 1–4 (draf untuk 12 program sudah terisi) dan **titik assessment**: awal di sesi pertama, tengah di sesi pertengahan (program lebih dari 4 sesi), akhir di sesi terakhir. Academic Lead bisa mengubah keduanya selama draf; setelah terbit daftar indikator dan titik assessment terkunci, sedangkan nama dan penjelasan skor tetap bisa diperbaiki.
2. Tutor menilai setiap siswa di sesi assessment paling lambat **48 jam** setelah sesi. Siswa yang tidak hadir dinilai susulan sebelum titik assessment berikutnya. Nilai draf belum terlihat siswa; setelah terbit tampil di menu **Progres** siswa dan wali.
3. Setelah assessment akhir terbit, tutor menyusun laporan (ringkasan nilai, kehadiran, dan tugas terisi otomatis) dan mengajukannya ke Academic Lead paling lambat **3 hari** setelah sesi terakhir. Lead meninjau dalam **2 hari**: mengonfirmasi level akhir lalu menerbitkan, atau mengembalikan dengan catatan.
4. Saat terbit, PDF laporan dibuat dan disimpan di bucket privat `report-files`; siswa dan wali mendapat notifikasi, bisa mengunduh PDF, dan mengambil program berikutnya tanpa placement ulang (level diambil dari laporan terakhir).
5. Jadwal harian juga mengingatkan tutor atas assessment/laporan yang lewat batas, mengingatkan Lead atas laporan yang menunggu lebih dari 2 hari, dan membuat ulang PDF yang sempat gagal.

Tampilan PDF diatur di `src/lib/report-pdf.tsx`. Contohnya bisa dibuat tanpa database dengan `npm run report:sample` (hasil di folder `e2e-output/`).

## Perintah lain

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Menjalankan tes database dan keamanan |
| `npm run check` | Cek tipe, lint, dan tes sekaligus |
| `npm run setup:role -- email role "Nama"` | Memberi role staf (owner, admin, lead, tutor) ke akun, atau membuat akun staf dengan password sementara |
| `npm run e2e:fase1` | Uji otomatis seluruh alur Fase 1 lewat browser (server dev harus berjalan); data uji dihapus otomatis |
| `npm run e2e:fase2` | Uji otomatis alur Fase 2: batch, pilih kelas, bayar, verifikasi, onboarding, notifikasi; data uji dihapus dan rekening dikembalikan |
| `npm run e2e:fase3` | Uji otomatis alur Fase 3: kurikulum, batch berkurikulum, absensi, tugas, revisi, feedback, mode baca saja; data uji dihapus dan kurikulum dikembalikan |
| `npm run e2e:fase4` | Uji otomatis alur Fase 4: rubrik, assessment awal/tengah/akhir, progres, laporan, review Lead, PDF, program lanjutan; data uji dihapus dan kurikulum dikembalikan |
| `npm run report:sample` | Membuat contoh PDF laporan dengan data contoh untuk meninjau tampilannya |
| `npm run db:migrate` | Memasang migrasi baru, seed (termasuk draf rubrik), dan bucket storage ke Supabase |
| `npm run seed:generate` | Membuat ulang `supabase/seed.sql` dari `src/data/catalog.ts` |
