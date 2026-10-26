# Milestone English

Sistem kursus bahasa Inggris Milestone English: landing page, pendaftaran, placement test, kelas, pembayaran, dan laporan progres untuk 6 role (Owner, Admin, Academic Lead, Tutor, Siswa, Wali).

Dibangun dengan Next.js dan Supabase, dideploy ke Vercel. Spesifikasi lengkap: [Spesifikasi Sistem Milestone English v1](https://claude.ai/artifact/WwSz5nhWAGsgZbzJmZ29pa).

## Mulai

```bash
npm install
npm run dev -- -p 3100
```

Tanpa `.env.local`, aplikasi berjalan dalam mode pratinjau: landing page memakai data awal dan login nonaktif. Untuk menyambungkan Supabase, ikuti [docs/SETUP.md](docs/SETUP.md).

## Struktur

| Folder | Isi |
| --- | --- |
| `src/app` | Halaman: landing (`/`), masuk, daftar, placement, portal per role |
| `src/components` | Komponen tampilan (landing, portal, logo, ikon) |
| `src/lib` | Koneksi Supabase, sesi, role dan menu, konten landing |
| `src/data/catalog.ts` | Data awal 12 program, FAQ, dan pengaturan |
| `supabase/migrations` | Skema database dan aturan keamanan (RLS) |
| `tests` | Tes database dan keamanan |

## Status pembangunan

| Fase | Isi | Status |
| --- | --- | --- |
| 0 | Fondasi: database, role, login email + password, landing page, kerangka portal | Selesai |
| 1 | Pendaftaran siswa/wali, placement test 5 bagian, penilaian tutor, publikasi Lead | Selesai, lulus uji alur 34/34; menunggu review |
| 2 | Kelas, pembayaran, onboarding, notifikasi | Belum |
| 3 | Belajar: kurikulum, sesi, absensi, tugas | Belum |
| 4 | Assessment dan laporan | Belum |
| 5 | Owner dan operasional | Belum |
| 6 | Uji coba dan rilis | Belum |
