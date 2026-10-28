# Uji coba manual dengan data contoh

Panduan ini untuk mencoba seluruh alur Milestone English sendiri, dari sudut pandang setiap role,
memakai data contoh (bukan data siswa sungguhan).

## 1. Persiapan (sekali)

1. Isi data contoh:
   ```bash
   npm run demo:isi
   ```
   Terminal menampilkan **satu password** untuk semua akun demo dan daftar alamat email akun. Daftar yang sama
   tersimpan di `e2e-output/akun-demo.txt`. Lupa password? Jalankan `npm run demo:password` untuk membuat password
   baru tanpa mengubah data.
2. Jalankan aplikasi:
   ```bash
   npm run dev
   ```
3. Siswa dan wali masuk di **http://localhost:3000/masuk**; akun tim (Owner, Admin, Lead, Tutor) di **http://localhost:3000/tim**.

Tips:
- Agar bisa berganti role tanpa keluar-masuk, buka beberapa jendela sekaligus: jendela biasa, jendela Incognito,
  dan browser lain. Satu jendela untuk satu akun.
- Email dan WhatsApp **belum terkirim** sampai Resend dan Fonnte disambungkan. Pesan yang seharusnya terkirim
  tetap tercatat di **Admin → Beranda → Notifikasi terakhir** dan **Owner → Pengaturan**.

## 2. Akun demo

| Akun | Isi datanya |
|---|---|
| Owner Demo | Dashboard bisnis berisi pemasukan, pengeluaran, dan 3 batch |
| Admin Demo | 1 bukti transfer menunggu verifikasi (Eka Saputra), 1 tiket menunggu balasan |
| Lead Demo | 1 laporan menunggu review (Budi Santoso), 1 observasi kelas |
| Tutor Demo | Absensi sesi 5 belum diisi, 3 tugas menunggu feedback, assessment tengah belum diisi, laporan Dewi belum disusun |
| Raka Pratama (Siswa) | Kelas SpeakUp berjalan (sesi 5 dari 8), 1 tugas bertenggat besok, 1 tiket |
| Ratna Wijaya (Wali) | 2 anak tanpa akun sendiri: Sinta (kelas berjalan, tugas sesi 4 belum dikumpulkan) dan Dewi (kelas selesai, laporan belum terbit) |
| Nadia Putri (Siswa Baru) | Baru mendaftar, belum placement test |

Batch contoh: **DEMO-SU-A** (berjalan), **DEMO-SU-B** (selesai), **DEMO-SU-C** (buka pendaftaran, mulai ±10 hari lagi).

## 3. Daftar periksa

Centang setiap langkah. Kalau ada yang membingungkan, salah, atau kurang, catat di kolom catatan.
Urutan di bawah mengikuti alur sungguhan, sehingga hasil satu role langsung terlihat di role berikutnya.

### A. Owner: siapkan rekening
- [ ] Masuk sebagai **Owner Demo** → **Pengaturan** → isi rekening tujuan pembayaran (boleh rekening asli).
      Tanpa rekening, siswa tidak tahu harus transfer ke mana.

### B. Siswa baru, dari placement sampai masuk kelas
- [ ] **Nadia (Siswa Baru)** → **Placement** → kerjakan tes 5 keterampilan sampai selesai.
      Catatan: soal listening belum punya audio (audio asli belum diunggah).
- [ ] **Lead Demo** → **Placement** → nilai writing/speaking Nadia → terbitkan hasilnya.
- [ ] **Nadia** → lihat hasil placement → pilih batch **DEMO-SU-C** → invoice terbit dengan batas bayar 2×24 jam.
- [ ] **Nadia** → **Pembayaran** → unggah bukti transfer (foto/PDF apa saja).
- [ ] **Admin Demo** → **Pembayaran** → verifikasi bukti Nadia. Coba juga **tolak** bukti **Eka Saputra** dengan alasan.
- [ ] **Nadia** → **Program Saya** → kelas aktif → baca halaman sambutan (onboarding).

### C. Kelas berjalan (DEMO-SU-A)
- [ ] **Tutor Demo** → **Sesi & Absensi** → isi absensi sesi 5. Tandai **Sinta tidak hadir** (wali akan mendapat pemberitahuan).
- [ ] **Tutor Demo** → **Tugas** → beri feedback 3 tugas yang menunggu: terima satu, minta revisi satu.
- [ ] **Tutor Demo** → **Assessment** → isi assessment tengah (sesi 4) untuk siswa batch A.
- [ ] **Raka (Siswa)** → **Materi & Tugas** → kumpulkan tugas sesi 5 (teks atau rekaman suara).
      Lihat juga feedback tutor, **Jadwal**, dan **Progres**.
- [ ] **Ratna (Wali)** → **Materi & Tugas** → kumpulkan tugas sesi 4 atas nama Sinta (Sinta tidak punya akun sendiri).
      Lihat **Jadwal & Kehadiran** Sinta.

### D. Kelas selesai dan laporan (DEMO-SU-B)
- [ ] **Lead Demo** → **Review Laporan** → buka laporan Budi → terbitkan (atau kembalikan ke tutor dengan catatan).
- [ ] **Tutor Demo** → **Laporan** → susun laporan Dewi → ajukan ke Lead.
- [ ] **Lead Demo** → terbitkan laporan Dewi → PDF laporan terbentuk.
- [ ] **Ratna (Wali)** → **Progres & Laporan** → buka laporan Dewi dan unduh PDF-nya. Isi survei tutor untuk Dewi.

### E. Bantuan (tiket)
- [ ] **Admin Demo** → **Bantuan** → balas tiket Raka "Link kelas sesi 6 belum muncul".
- [ ] **Raka** → **Bantuan** → lihat balasan → balas lagi atau buat tiket baru.
- [ ] **Admin Demo** → tutup tiket.

### F. Owner dan Lead: memantau
- [ ] **Owner Demo** → **Beranda**: ganti periode (bulan / 3 bulan / tahun), cek angka siswa aktif, pemasukan, funnel, dan grafik.
- [ ] **Owner Demo** → **Keuangan**: tambah satu pengeluaran (boleh dengan foto nota), unduh CSV.
- [ ] **Owner Demo** → **Staf & Role**: tambah staf baru, lalu nonaktifkan.
- [ ] **Owner Demo** → **Program & Harga**: lihat harga dan status program. Perubahan di sini **tetap tersimpan**
      setelah data contoh dihapus, jadi kembalikan bila hanya mencoba.
- [ ] **Owner Demo** → **Audit Log**: semua langkah di atas tercatat.
- [ ] **Owner Demo** → **Pengaturan** → unduh backup ZIP.
- [ ] **Lead Demo** → **Kualitas Tutor**: lihat ketepatan waktu tutor, survei, dan observasi; tambahkan satu observasi.

### G. Website publik (dua bahasa)
- [ ] Buka **http://localhost:3000** tanpa masuk: cek teks, program, harga, dan apakah batch SpeakUp yang buka pendaftaran tampil.
- [ ] Klik **EN** di menu atas (**http://localhost:3000/en**): cek landing page, Daftar, Masuk, dan Lupa password dalam bahasa Inggris.
- [ ] **Owner Demo** → **CMS Website** (Admin tidak lagi punya menu ini):
  - **Teks** → ubah satu teks Indonesia, lalu pilih **English** dan rapikan terjemahannya.
  - **Telah dipercaya oleh**, **Tutor kami**, **Galeri**: tambah satu kartu masing-masing (dengan foto/logo), lalu cek di website.
  - **Testimoni**: tambah satu dengan foto, nyalakan (On), lalu cek di website.
  - **Bagian website**: matikan satu bagian, cek di website bahwa bagian itu hilang, lalu nyalakan lagi.
- [ ] **Owner Demo** → **Pengaturan** → **Template notifikasi**: buka dan ubah satu template.
      Perubahan CMS **tetap tersimpan** setelah data contoh dihapus.

## 4. Selesai uji coba

Hapus semua data contoh, termasuk semua yang Anda buat lewat akun demo (pendaftaran Nadia, tiket, pengeluaran,
staf yang ditambahkan Owner Demo, file yang diunggah, dan catatan audit):
```bash
npm run demo:hapus
```
Kurikulum SpeakUp kembali menjadi draf. Yang **tidak** dikembalikan: perubahan teks website, harga/status program,
soal placement, isi kurikulum, dan rekening. Semuanya memang akan Anda isi dengan konten asli sebelum rilis.
Akun yang Anda daftarkan sendiri lewat halaman Daftar (bukan akun demo) juga tidak ikut terhapus.

Ingin mengulang dari awal? Jalankan `npm run demo:hapus` lalu `npm run demo:isi` lagi.
