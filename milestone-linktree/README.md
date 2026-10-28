# Milestone Linktree

Halaman link untuk bio Instagram, dibuat dengan Google Apps Script dan Google Sheet. Tidak perlu hosting dan gratis.

- **Halaman publik**: alamat Web App. Alamat ini yang dipasang di bio Instagram.
- **Halaman admin**: alamat Web App ditambah `?admin`. Masuk dengan PIN 4 angka.
- **Data**: Google Sheet dengan tab `Pengaturan`, `Link`, `Klik`, dan `Ringkasan bulanan`. Sheet ini sekaligus menjadi cadangan.

## Isi folder

| File | Fungsi |
|---|---|
| `Code.gs` | Server: membaca dan menyimpan data, login PIN, pencatat klik, statistik |
| `Index.html` | Halaman publik |
| `Admin.html` | Halaman admin |
| `Render.html` | Tampilan halaman link, dipakai halaman publik dan pratinjau admin |

## Pemasangan (sekitar 10 menit)

### 1. Buat Google Sheet

1. Buka [sheets.new](https://sheets.new) dengan akun Google Milestone. Jangan pakai akun pribadi.
2. Beri nama `Milestone Linktree`.

### 2. Tempel kode

1. Di Sheet itu buka menu **Ekstensi → Apps Script**.
2. Ganti nama proyek (kiri atas) menjadi `Milestone Linktree`.
3. Buka file `Code.gs`, hapus seluruh isinya, lalu tempel isi `Code.gs` dari folder ini.
4. Klik **+** di samping **File**, pilih **HTML**, lalu beri nama `Index` (tanpa `.html`). Hapus isinya dan tempel isi `Index.html`.
5. Ulangi untuk `Admin` dan `Render`.
6. Klik ikon simpan (Ctrl+S).

### 3. Atur PIN admin

1. Klik ikon gerigi **Project Settings** di menu kiri.
2. Gulir ke **Script Properties**, klik **Add script property**, lalu isi:
   - Property: `ADMIN_PIN`
   - Value: 4 angka pilihan Anda. Hindari angka kembar atau berurutan seperti `1111` atau `1234`.
3. Klik **Save script properties**.

PIN ini tidak tertulis di kode. Nanti PIN bisa diganti dari halaman admin, menu **Keamanan**.

### 4. Siapkan Sheet

1. Kembali ke **Editor** (ikon `< >`).
2. Di bagian atas pilih fungsi `setup`, lalu klik **Run**.
3. Google meminta izin. Klik **Review permissions**, pilih akun Milestone, lalu **Advanced → Go to Milestone Linktree (unsafe) → Allow**.
   Peringatan "unsafe" memang muncul untuk skrip buatan sendiri. Yang meminta izin adalah skrip Anda sendiri.
4. Setelah selesai, Sheet berisi tab `Pengaturan`, `Link` (4 link contoh), `Klik`, dan `Ringkasan bulanan`.
5. Pilih fungsi `pasangArsip`, lalu klik **Run** untuk menyalakan arsip otomatis. Bila Google meminta izin tambahan, izinkan seperti langkah 3.

### 5. Terbitkan sebagai Web App

1. Klik **Deploy → New deployment**.
2. Klik ikon gerigi di samping **Select type**, lalu pilih **Web app**.
3. Isi:
   - Description: `Linktree`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

### 6. Isi halaman

1. Buka Web app URL ditambah `?admin`, misalnya `https://script.google.com/macros/s/XXXX/exec?admin`.
2. Masukkan PIN.
3. Di menu **Link**, ganti 4 link contoh (alamatnya masih `contoh.com`) dengan link asli.
4. Di menu **Profil & kontak**, isi nomor WhatsApp dan akun sosial media.
5. Klik **Simpan**, lalu klik **Lihat halaman** untuk memeriksa hasilnya.

### 7. Pasang di bio Instagram

Alamat Web App panjang, jadi buat link pendek di [s.id](https://s.id) atau [bit.ly](https://bit.ly) yang mengarah ke Web app URL. Contoh: `s.id/milestoneenglish`.
Pasang link pendek itu di bio Instagram.

Keuntungannya, kalau suatu saat halaman link pindah ke website Milestone English sendiri, cukup ubah tujuan link pendeknya.
Bio Instagram tidak perlu diubah.

## Fitur

**Halaman publik**
- Logo, nama, bio, dan ikon sosial media (Instagram, TikTok, YouTube, Facebook, email, website).
- Daftar tombol link, masing-masing dengan ikon dan keterangan kecil.
- Tombol unggulan berwarna menonjol, misalnya untuk promo atau placement test.
- Tombol WhatsApp yang langsung membuka chat dengan pesan otomatis.
- Jadwal tayang per link: atur tanggal mulai dan selesai, link tampil dan hilang sendiri.
- Ringan dan rapi di HP.

**Halaman admin** (`?admin`)
- Login dengan PIN 4 angka. Sesi berlaku 8 jam. Setelah 5 kali PIN salah, login dikunci 15 menit.
- **Link**: tambah, ubah, hapus, ubah urutan, on/off, jadikan unggulan, atur jadwal tayang.
- **Profil & kontak**: logo (diperkecil otomatis), nama, bio, tombol WhatsApp, akun sosial media.
- **Tampilan**: 3 tema siap pakai (Navy Milestone, Terang, Oranye), 6 warna yang bisa diatur, bentuk tombol, dan peringatan bila warna kurang kontras.
- **Pratinjau langsung**: tampilan HP berubah saat Anda mengetik, sebelum disimpan.
- **Statistik**: jumlah kunjungan, klik, rasio klik, klik per link, dan rincian per hari (7, 30, atau 90 hari). Ringkasan 12 bulan terakhir (kunjungan, klik, rasio, link teratas) dan status arsip otomatis.

**Arsip otomatis**
- Setiap 90 hari, catatan di tab `Klik` yang lebih tua dari 90 hari dipindah ke file `Milestone Linktree · Arsip <tahun>` di Google Drive, lalu dijumlahkan per bulan di tab `Ringkasan bulanan`.
- Di antara dua arsip, tab `Klik` berisi 90 sampai 180 hari data. Statistik 7/30/90 hari tidak terpengaruh.
- Pemicu berjalan setiap hari sekitar jam 02.00 WIB dan hanya bekerja bila arsip terakhir sudah 90 hari lalu. Jangan hapus file arsip; bila terhapus, catatan berikutnya masuk ke file baru.
- **Keamanan**: ganti PIN. Setelah PIN diganti, perangkat lain otomatis keluar.

## Memperbarui kode

Kalau kode di folder ini berubah:

1. Tempel ulang file yang berubah di editor Apps Script, lalu simpan.
2. Klik **Deploy → Manage deployments**, klik ikon pensil, pilih **Version: New version**, lalu **Deploy**.

Alamat Web App tidak berubah, jadi link di bio Instagram tetap jalan.

## Catatan

- Google menampilkan baris kecil di atas halaman bertuliskan "This application was created by a Google Apps Script user". Ini aturan Google untuk akun Gmail biasa dan tidak bisa dihilangkan.
- Halaman terbuka dalam sekitar 1–2 detik.
- Mengubah data langsung di Google Sheet juga bisa. Perubahan tampil paling lambat 5 menit. Perubahan dari halaman admin langsung tampil.
- Klik hanya tercatat dari alamat `/exec`, bukan dari alamat uji `/dev`.
- Lupa PIN? Buka Apps Script → Project Settings → Script Properties, lalu ubah nilai `ADMIN_PIN`.
