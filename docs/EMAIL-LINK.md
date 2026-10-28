# Link email Supabase: konfirmasi akun dan reset password

Supabase membuat, mengirim, dan memeriksa link konfirmasi akun dan link reset password. Tidak ada kode OTP dan
tidak perlu Resend. Yang dibutuhkan hanya **jalur kirim (SMTP)**, karena pengirim bawaan Supabase hanya mengirim ke
anggota tim akun Supabase dan hanya beberapa email per jam.

Panduan ini memakai **Gmail khusus Milestone** (gratis, sekitar 500 email per hari, tanpa domain).

## Cara kerja di aplikasi

Satu saklar mengatur semuanya: **Confirm email** di Supabase.

| Confirm email | Daftar | Lupa password |
|---|---|---|
| Mati (sekarang) | Langsung masuk portal | Siswa/wali chat admin; admin membuat password sementara |
| Nyala | Email "Konfirmasi akun" terkirim; setelah link diklik, langsung masuk portal | Siswa/wali/staf mengisi email, menerima link, lalu membuat password baru sendiri |

Reset oleh admin (menu **Pendaftaran**) dan oleh Owner (menu **Staf & Role**) tetap tersedia sebagai cadangan,
misalnya untuk siswa yang salah ketik email. Halaman Masuk menampilkan tombol **Kirim ulang link konfirmasi** bila
akun belum dikonfirmasi.

> Nyalakan **Confirm email** hanya setelah langkah 1 sampai 3 selesai. Kalau dinyalakan lebih dulu, siswa baru
> tidak bisa masuk karena link konfirmasinya tidak pernah sampai.

## 1. Siapkan Gmail khusus Milestone

1. Buat akun Gmail baru, misalnya `milestoneenglish.id@gmail.com`. Jangan memakai Gmail pribadi.
2. Buka **myaccount.google.com → Keamanan**, lalu aktifkan **Verifikasi 2 Langkah**.
3. Masih di **Keamanan**, cari **Sandi aplikasi** (App passwords). Buat sandi baru dengan nama `Supabase`.
4. Google menampilkan sandi 16 huruf. Salin sandi itu dan simpan di tempat aman. Sandi ini hanya ditampilkan sekali.

## 2. Sambungkan Gmail di Supabase

Buka Supabase → **Authentication → Emails → SMTP Settings**, nyalakan **Enable custom SMTP**, lalu isi:

| Isian | Nilai |
|---|---|
| Sender email | Gmail Milestone tadi |
| Sender name | `Milestone English` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | Gmail Milestone tadi |
| Password | sandi aplikasi 16 huruf dari langkah 1 |
| Minimum interval | `60` detik |

Simpan. Di **Authentication → Rate Limits**, naikkan batas email per jam, misalnya menjadi `100`.

## 3. Alamat website dan template email

1. **Authentication → URL Configuration**:
   - **Site URL**: alamat yang dipakai siswa. Untuk uji coba di laptop: `http://localhost:3000`. Setelah deploy, ganti dengan domain asli.
   - **Redirect URLs**: `http://localhost:3000/**`, lalu nanti tambahkan `https://domainkamu.com/**`.
2. **Authentication → Emails → Templates**. Ganti dua template berikut. Link di template ini bisa dibuka dari
   browser atau HP mana pun, tidak harus browser tempat mendaftar. Bagian `redirect_to` membuat pengguna yang
   meminta dari halaman English kembali ke halaman English; biarkan tetap di akhir link.

### Confirm signup

Subject: `Konfirmasi akun / Confirm your account · Milestone English`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937">
  <h2 style="color:#0b1426">Selamat datang di Milestone English!</h2>
  <p>Satu langkah lagi. Klik tombol di bawah untuk mengaktifkan akunmu, lalu kamu langsung masuk ke portal.</p>
  <p style="margin:28px 0">
    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}"
       style="background:#f58220;color:#0b1426;padding:12px 24px;border-radius:10px;font-weight:bold;text-decoration:none">
      Konfirmasi akun · Confirm account
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280">Link berlaku 24 jam. Kalau kamu tidak merasa mendaftar, abaikan email ini.</p>
  <p style="font-size:13px;color:#6b7280"><b>English:</b> One more step. Click the button above to activate your account and go straight to the portal. The link is valid for 24 hours. If you did not sign up, please ignore this email.</p>
</div>
```

### Reset password

Subject: `Atur ulang password / Reset your password · Milestone English`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937">
  <h2 style="color:#0b1426">Atur ulang password</h2>
  <p>Kami menerima permintaan untuk membuat password baru akun Milestone English-mu.</p>
  <p style="margin:28px 0">
    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}"
       style="background:#f58220;color:#0b1426;padding:12px 24px;border-radius:10px;font-weight:bold;text-decoration:none">
      Buat password baru · Create new password
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280">Link berlaku 1 jam. Kalau kamu tidak memintanya, abaikan email ini; password lama tetap berlaku.</p>
  <p style="font-size:13px;color:#6b7280"><b>English:</b> We received a request to create a new password for your Milestone English account. The link is valid for 1 hour. If you did not request it, ignore this email; your current password stays the same.</p>
</div>
```

## 4. Nyalakan

1. **Authentication → Sign In / Providers → Email** → nyalakan **Confirm email**.
2. Tunggu sekitar 1 menit (aplikasi membaca saklar ini tiap menit), lalu buka `/lupa-password`. Halaman itu
   sekarang berisi kolom email, bukan tombol chat admin.

## 5. Uji

1. Daftar akun baru di `/daftar` memakai email sungguhan milikmu. Halaman menampilkan "Cek email kamu".
2. Buka email itu (cek juga folder Spam/Promosi), klik **Konfirmasi akun**. Kamu masuk ke portal.
3. Keluar, buka **Lupa password**, isi email yang sama, klik link di email, lalu buat password baru.
4. Masuk dengan password baru.

Kalau email tidak datang: periksa isian SMTP (terutama sandi aplikasi), lalu lihat **Authentication → Logs** di Supabase.

## Mematikan lagi

Matikan **Confirm email**. Aplikasi otomatis kembali ke alur reset oleh admin dalam sekitar 1 menit.
Akun yang sudah ada tidak terpengaruh.
