-- Dibuat otomatis oleh scripts/generate-seed.ts. Jangan diedit manual.

insert into public.programs (code, slug, name, category, entry_level, duration_label, capacity, price_idr, outcome, evidence, featured, sort_order) values
  ('EZ', 'english-zero', 'English Zero', 'Everyday English', 'Pre-A1–A1', '4 minggu (8 × 60 mnt)', 6, 349000, 'Memperkenalkan diri dan bercakap dasar dengan bantuan terbatas.', 'Rekaman perkenalan 1–2 menit dan dialog singkat.', true, 1),
  ('SU', 'speakup', 'SpeakUp', 'Everyday English', 'A1–B1', '4 minggu (8 × 60 mnt)', 6, 349000, 'Mempertahankan percakapan 5 menit, bertanya balik, dan meminta klarifikasi.', 'Rekaman percakapan awal dan akhir.', true, 2),
  ('EC', 'english-circle', 'English Circle', 'Everyday English', 'A2+', 'Membership bulanan (4 × 60 mnt)', 6, 199000, 'Menyelesaikan target praktik bulanan dan memperbaiki keterampilan fokus.', 'Log praktik bulanan, sampel rekaman, dan review tutor.', false, 3),
  ('SR', 'scoreready', 'ScoreReady', 'Academic English', 'Assessment diagnostik', '8 minggu (16 × 90 mnt)', 6, 1099000, 'Memperbaiki performa per bagian tes TOEFL/IELTS berbasis diagnostik awal.', 'Simulasi diagnostik awal dibanding simulasi akhir dengan format sebanding.', true, 4),
  ('AW', 'academicwrite', 'AcademicWrite', 'Academic English', 'B1–B2', '6 minggu (8 × 90 mnt)', 6, 699000, 'Menulis teks akademik 500–700 kata dengan sitasi, parafrasa, dan struktur yang valid.', 'Draf awal, catatan revisi, dan naskah esai final.', false, 5),
  ('SS', 'scholarspeak', 'ScholarSpeak', 'Academic English', 'B1–B2', '4 minggu (8 × 60 mnt)', 6, 499000, 'Menjelaskan motivasi, rencana studi, dan kontribusi dalam simulasi wawancara beasiswa.', 'Rekaman mock interview dan kerangka jawaban terstruktur.', true, 6),
  ('LL', 'litlab', 'LitLab', 'Young Learners', 'A2–B2 (usia 13–18)', '4 minggu (4 × 90 mnt)', 6, 299000, 'Memahami teks sastra/film, mendiskusikan tema, dan menyusun ulasan 200–300 kata.', 'Diskusi terekam dan ulasan tertulis terstruktur.', false, 7),
  ('LIL', 'littlelingo', 'LittleLingo', 'Young Learners', 'Pemula–A1 (usia 6–12)', '4 minggu (8 × 45 mnt)', 4, 499000, 'Memperkenalkan diri, mengenali kosakata tematik, dan mengikuti instruksi tutor.', 'Portofolio aktivitas dan video demonstrasi lisan anak.', true, 8),
  ('TT', 'teentalk', 'TeenTalk', 'Young Learners', 'A1–B1 (usia 13–17)', '4 minggu (8 × 60 mnt)', 6, 349000, 'Menyampaikan presentasi 3 menit dan merespons pertanyaan sederhana dengan percaya diri.', 'Rekaman presentasi mandiri dan sesi tanya jawab.', false, 9),
  ('EFC', 'english-for-career', 'English for Career', 'Professional English', 'A2–B1 (usia 18+)', '4 minggu (8 × 60 mnt)', 6, 499000, 'Menjalani simulasi wawancara kerja 10–15 menit untuk posisi sasaran.', 'Rekaman mock interview profesional dan evaluasi tutor.', true, 10),
  ('SE', 'serviceenglish', 'ServiceEnglish', 'Professional English', 'A2–B1', '4 minggu (8 × 60 mnt)', 6, 499000, 'Menyelesaikan 4 skenario layanan pelanggan: hospitality, F&B, dan penanganan keluhan.', 'Rekaman role-play skenario dan checklist standar layanan.', false, 11),
  ('SST', 'speakstage', 'SpeakStage', 'Professional English', 'B1–B2', '4 minggu (8 × 60 mnt)', 6, 499000, 'Menyampaikan presentasi bisnis 5 menit dan menjawab 2 pertanyaan kritis.', 'Video presentasi profesional dan rekaman tanya jawab.', false, 12)
on conflict (code) do nothing;

insert into public.faqs (question, answer, sort_order)
select * from (values
  ('Apa yang membedakan Milestone English dengan kursus bahasa Inggris biasa?', 'Setiap program punya target outcome yang jelas. Kemampuan awal diukur lewat placement test dan rekaman baseline, lalu di akhir program kamu menerima laporan yang membandingkan hasil awal dan akhir dengan rubrik yang sama.', 1),
  ('Apakah ada placement test sebelum masuk kelas?', 'Ya, placement test wajib untuk setiap siswa baru dan bisa dicoba gratis dari halaman ini. Tes berlangsung sekitar 25–30 menit dan mengukur grammar, reading, listening, writing, dan speaking. Hasil writing dan speaking dinilai tutor paling lambat 1×24 jam.', 2),
  ('Bagaimana cara pembayarannya?', 'Setelah memilih jadwal kelas, tagihan muncul otomatis di portal. Lakukan transfer, unggah bukti pembayaran, dan kelas aktif setelah tim admin memverifikasinya. Kamu mendapat pemberitahuan lewat email dan WhatsApp.', 3),
  ('Berapa jumlah peserta dalam satu kelas?', 'Kapasitas kelas dibatasi 4 sampai 6 peserta per batch, supaya setiap peserta mendapat waktu berbicara dan feedback yang cukup dari tutor.', 4)
) as v(question, answer, sort_order)
where not exists (select 1 from public.faqs);

insert into public.site_settings (key, value) values
  ('contact', '{"whatsapp":"","email":"","address":""}'::jsonb),
  ('hero', '{"badge":"Outcome-based English learning | 12 pilihan program","title_start":"Start Your","title_accent":"English Milestone","title_end":"With Clear Outcomes","subtitle":"12 program bahasa Inggris untuk speaking, academic goals, kids, scholarship, dan career. Semua dibangun dengan kelas kecil, rubrik, dan bukti progres nyata."}'::jsonb)
on conflict (key) do nothing;
