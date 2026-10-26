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

-- Draf bank soal placement; hanya diisi saat tabel masih kosong.
insert into public.placement_questions (section, group_key, passage, prompt, options, answer_index, cefr, sort_order)
select * from (values
  ('grammar', null, null, 'She ___ a teacher at a primary school.', '["am","is","are","be"]'::jsonb, 1, 'A1', 1),
  ('grammar', null, null, 'I ___ coffee every morning before work.', '["drink","drinks","drinking","am drink"]'::jsonb, 0, 'A1', 2),
  ('grammar', null, null, 'There ___ two books on the table.', '["is","are","be","am"]'::jsonb, 1, 'A1', 3),
  ('grammar', null, null, 'Yesterday we ___ to the beach with our friends.', '["go","goes","went","gone"]'::jsonb, 2, 'A2', 4),
  ('grammar', null, null, 'This bag is ___ than the black one.', '["expensive","more expensive","most expensive","expensiver"]'::jsonb, 1, 'A2', 5),
  ('grammar', null, null, 'Have you ever ___ Japanese food?', '["eat","ate","eaten","eating"]'::jsonb, 2, 'A2', 6),
  ('grammar', null, null, 'If it rains tomorrow, we ___ at home.', '["stay","will stay","would stay","stayed"]'::jsonb, 1, 'B1', 7),
  ('grammar', null, null, 'I have been living in this city ___ 2019.', '["for","since","from","during"]'::jsonb, 1, 'B1', 8),
  ('grammar', null, null, 'The report ___ by the manager last week.', '["wrote","was written","has written","is writing"]'::jsonb, 1, 'B1', 9),
  ('grammar', null, null, 'If I ___ about the traffic, I would have left earlier.', '["knew","had known","have known","would know"]'::jsonb, 1, 'B2', 10),
  ('grammar', null, null, 'She suggested ___ the meeting until Friday.', '["to postpone","postponing","postpone","postponed"]'::jsonb, 1, 'B2', 11),
  ('grammar', null, null, 'Hardly ___ the station when the train left.', '["I had reached","had I reached","I reached","did I reached"]'::jsonb, 1, 'B2', 12),
  ('reading', 'reading-club', 'Hi Dina,

Thanks for asking about the English Club. We meet every Tuesday from 7 to 8:30 p.m. in Room 4 on the second floor of the library. Each week we choose a topic, like food or travel, and talk in small groups. You don''t need to pay, but please bring a notebook. Next week is a little different: we will meet on Wednesday because the library is closed on Tuesday for cleaning.

See you there,
Rina', 'How often does the English Club meet?', '["Every day","Once a week","Twice a week","Once a month"]'::jsonb, 1, 'A2', 13),
  ('reading', 'reading-club', 'Hi Dina,

Thanks for asking about the English Club. We meet every Tuesday from 7 to 8:30 p.m. in Room 4 on the second floor of the library. Each week we choose a topic, like food or travel, and talk in small groups. You don''t need to pay, but please bring a notebook. Next week is a little different: we will meet on Wednesday because the library is closed on Tuesday for cleaning.

See you there,
Rina', 'Where does the club meet?', '["In a cafe","In Rina''s house","In the library","In a school hall"]'::jsonb, 2, 'A2', 14),
  ('reading', 'reading-club', 'Hi Dina,

Thanks for asking about the English Club. We meet every Tuesday from 7 to 8:30 p.m. in Room 4 on the second floor of the library. Each week we choose a topic, like food or travel, and talk in small groups. You don''t need to pay, but please bring a notebook. Next week is a little different: we will meet on Wednesday because the library is closed on Tuesday for cleaning.

See you there,
Rina', 'What should Dina bring?', '["Money","A notebook","Food","A dictionary"]'::jsonb, 1, 'A2', 15),
  ('reading', 'reading-club', 'Hi Dina,

Thanks for asking about the English Club. We meet every Tuesday from 7 to 8:30 p.m. in Room 4 on the second floor of the library. Each week we choose a topic, like food or travel, and talk in small groups. You don''t need to pay, but please bring a notebook. Next week is a little different: we will meet on Wednesday because the library is closed on Tuesday for cleaning.

See you there,
Rina', 'Why is next week''s meeting on Wednesday?', '["The teacher is busy","Tuesday is a holiday","The library is closed on Tuesday","The room is too small"]'::jsonb, 2, 'A2', 16),
  ('reading', 'reading-speaking', 'Many people believe that learning a language is mostly about memorising words. However, research on language learning suggests that regular speaking practice matters just as much. Learners who talk for even ten minutes a day often become more confident than those who study vocabulary lists for an hour. The reason is simple: speaking forces the brain to find words quickly and put them into sentences. Mistakes are a normal part of this process. In fact, teachers say that students who are afraid of making mistakes usually improve more slowly, because they avoid the practice they need most.', 'What is the main idea of the text?', '["Vocabulary lists are the best way to learn","Regular speaking practice is very important","Teachers should correct every mistake","Learning a language takes many years"]'::jsonb, 1, 'B1', 17),
  ('reading', 'reading-speaking', 'Many people believe that learning a language is mostly about memorising words. However, research on language learning suggests that regular speaking practice matters just as much. Learners who talk for even ten minutes a day often become more confident than those who study vocabulary lists for an hour. The reason is simple: speaking forces the brain to find words quickly and put them into sentences. Mistakes are a normal part of this process. In fact, teachers say that students who are afraid of making mistakes usually improve more slowly, because they avoid the practice they need most.', 'According to the text, learners who speak ten minutes a day often…', '["forget more words","become more confident","make fewer mistakes","study for an hour"]'::jsonb, 1, 'B1', 18),
  ('reading', 'reading-speaking', 'Many people believe that learning a language is mostly about memorising words. However, research on language learning suggests that regular speaking practice matters just as much. Learners who talk for even ten minutes a day often become more confident than those who study vocabulary lists for an hour. The reason is simple: speaking forces the brain to find words quickly and put them into sentences. Mistakes are a normal part of this process. In fact, teachers say that students who are afraid of making mistakes usually improve more slowly, because they avoid the practice they need most.', 'Why does speaking help, according to the writer?', '["It is more fun than reading","It makes learners find words and build sentences quickly","It replaces grammar study","Teachers prefer it"]'::jsonb, 1, 'B2', 19),
  ('reading', 'reading-speaking', 'Many people believe that learning a language is mostly about memorising words. However, research on language learning suggests that regular speaking practice matters just as much. Learners who talk for even ten minutes a day often become more confident than those who study vocabulary lists for an hour. The reason is simple: speaking forces the brain to find words quickly and put them into sentences. Mistakes are a normal part of this process. In fact, teachers say that students who are afraid of making mistakes usually improve more slowly, because they avoid the practice they need most.', 'What does the writer imply about students who fear mistakes?', '["They learn faster","They speak more often","They miss the practice they need","They should study vocabulary first"]'::jsonb, 2, 'B2', 20),
  ('listening', 'listening-cafe', 'Woman: Good evening, Bella Cafe. How can I help you?
Man: Hi, I''d like to book a table for four people on Saturday, please.
Woman: Sure. What time would you like?
Man: Around seven in the evening.
Woman: I''m sorry, seven is full. We have a table at half past seven.
Man: That''s fine. Can we sit outside?
Woman: Yes, there''s one table left on the terrace. Can I have your name?
Man: It''s Arif. A-R-I-F.', 'How many people is the table for?', '["Two","Three","Four","Five"]'::jsonb, 2, 'A2', 21),
  ('listening', 'listening-cafe', 'Woman: Good evening, Bella Cafe. How can I help you?
Man: Hi, I''d like to book a table for four people on Saturday, please.
Woman: Sure. What time would you like?
Man: Around seven in the evening.
Woman: I''m sorry, seven is full. We have a table at half past seven.
Man: That''s fine. Can we sit outside?
Woman: Yes, there''s one table left on the terrace. Can I have your name?
Man: It''s Arif. A-R-I-F.', 'What time is the booking?', '["6:30","7:00","7:30","8:00"]'::jsonb, 2, 'A2', 22),
  ('listening', 'listening-cafe', 'Woman: Good evening, Bella Cafe. How can I help you?
Man: Hi, I''d like to book a table for four people on Saturday, please.
Woman: Sure. What time would you like?
Man: Around seven in the evening.
Woman: I''m sorry, seven is full. We have a table at half past seven.
Man: That''s fine. Can we sit outside?
Woman: Yes, there''s one table left on the terrace. Can I have your name?
Man: It''s Arif. A-R-I-F.', 'Where will they sit?', '["Inside, near the window","On the terrace","At the bar","In a private room"]'::jsonb, 1, 'A2', 23),
  ('listening', 'listening-train', 'Attention, please. This is an announcement for passengers travelling to Bandung. The 10:15 train will now depart from platform 6, not platform 3. Because of maintenance work on the line, the journey will take about twenty minutes longer than usual. Passengers are reminded that food and drinks are available in carriage 4. We apologise for any inconvenience.', 'Which platform will the train leave from?', '["Platform 3","Platform 4","Platform 6","Platform 10"]'::jsonb, 2, 'B1', 24),
  ('listening', 'listening-train', 'Attention, please. This is an announcement for passengers travelling to Bandung. The 10:15 train will now depart from platform 6, not platform 3. Because of maintenance work on the line, the journey will take about twenty minutes longer than usual. Passengers are reminded that food and drinks are available in carriage 4. We apologise for any inconvenience.', 'Why will the journey take longer?', '["Bad weather","Maintenance work on the line","A late driver","Too many passengers"]'::jsonb, 1, 'B1', 25),
  ('listening', 'listening-train', 'Attention, please. This is an announcement for passengers travelling to Bandung. The 10:15 train will now depart from platform 6, not platform 3. Because of maintenance work on the line, the journey will take about twenty minutes longer than usual. Passengers are reminded that food and drinks are available in carriage 4. We apologise for any inconvenience.', 'Where can passengers buy food?', '["On platform 6","In carriage 4","At the ticket office","Nowhere on the train"]'::jsonb, 1, 'B1', 26),
  ('writing', null, null, 'Write 80–120 words in English. Describe your usual day and explain why you want to improve your English. (Tulis 80–120 kata dalam bahasa Inggris tentang kegiatan harianmu dan alasan kamu ingin meningkatkan bahasa Inggris.)', null, null, null, 27),
  ('speaking', null, null, 'Introduce yourself: your name, where you live, and what you do every day. (Perkenalkan diri sekitar 1 menit.)', null, null, null, 28),
  ('speaking', null, null, 'Tell us about a memorable experience in your life and explain why it was important to you. (Ceritakan sekitar 1–2 menit.)', null, null, null, 29)
) as v(section, group_key, passage, prompt, options, answer_index, cefr, sort_order)
where not exists (select 1 from public.placement_questions);

-- Draf kurikulum versi 1 untuk ditinjau Academic Lead; hanya untuk program yang belum punya kurikulum.
with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum English Zero' from public.programs p
  where p.code = 'EZ' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Hello! Greetings & introducing yourself', 'Siswa bisa menyapa, menyebut nama, asal, dan pekerjaan/sekolah dengan kalimat sederhana.', '• Sapaan formal dan santai: Hello, Hi, Good morning, Nice to meet you.
• Pola: My name is…, I''m from…, I''m a/an…, I live in…
• Alfabet dan mengeja nama (How do you spell it?).
• Baseline: setiap siswa merekam perkenalan singkat sebagai pembanding di akhir program.'),
  (2, 1, 'Numbers, age, and contact details', 'Siswa bisa menyebut angka 1–100, umur, nomor telepon, dan alamat email.', '• Angka 1–100 dan perbedaan thirteen/thirty.
• How old are you? What''s your phone number? What''s your email address?
• Simbol email: at, dot, underscore.
• Latihan berpasangan: mengisi formulir pendaftaran lisan.'),
  (3, 2, 'My family and the people around me', 'Siswa bisa memperkenalkan anggota keluarga dan menjelaskan hubungan dengan kata sederhana.', '• Kosakata keluarga: mother, father, brother, sister, husband, wife, son, daughter.
• Possessive: my, your, his, her; ''s (Rina''s brother).
• have/has: I have two sisters.
• Kegiatan: menceritakan foto keluarga.'),
  (4, 2, 'Daily routines', 'Siswa bisa menceritakan rutinitas harian memakai simple present dan keterangan waktu.', '• Kata kerja rutinitas: wake up, have breakfast, go to work, study, cook, sleep.
• Simple present dan he/she + -s.
• Jam dan keterangan waktu: at 7 o''clock, in the morning, every day.
• Adverb of frequency: always, usually, sometimes, never.'),
  (5, 3, 'Food, drinks, and likes', 'Siswa bisa menyatakan suka/tidak suka dan memesan makanan sederhana.', '• Kosakata makanan dan minuman sehari-hari.
• I like…, I don''t like…, Do you like…?
• Memesan: Can I have…, please? How much is it?
• Cek tengah program: tutor mencatat kemajuan berbicara tiap siswa.'),
  (6, 3, 'Places in town and directions', 'Siswa bisa menanyakan dan memberi petunjuk arah sederhana.', '• Tempat: bank, hospital, supermarket, station, mosque, school.
• There is/There are; preposisi next to, opposite, between.
• Arah: go straight, turn left/right, it''s on the left.
• Role-play menanyakan jalan.'),
  (7, 4, 'Asking questions and small talk', 'Siswa bisa memulai dan mempertahankan obrolan singkat dengan pertanyaan dasar.', '• Question words: what, where, when, who, how.
• Pertanyaan umum untuk small talk: What do you do? Where do you live? What do you do on weekends?
• Merespons dan bertanya balik: And you? Really? That''s nice!
• Latihan percakapan 2–3 menit berpasangan.'),
  (8, 4, 'Final: introduce yourself with confidence', 'Siswa menunjukkan perkenalan diri dan dialog dasar yang lebih lancar dibanding rekaman awal.', '• Review seluruh pola dari sesi 1–7.
• Assessment akhir: perkenalan 1–2 menit dan dialog singkat dengan tutor, dinilai dengan rubrik yang sama seperti baseline.
• Refleksi: apa yang sudah bisa dan target berikutnya.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekam perkenalan pertamamu', 'Rekam perkenalan 30–60 detik dalam bahasa Inggris: nama, asal, tempat tinggal, dan pekerjaan atau sekolah. Tidak apa-apa jika masih terbata-bata; rekaman ini menjadi titik awal perkembanganmu.', 'audio'),
  (2, 'Formulir data diri', 'Tulis 5 kalimat tentang dirimu yang memuat umur, nomor telepon (boleh nomor fiktif), email, dan kota asal. Contoh: I''m 24 years old.', 'text'),
  (3, 'Cerita foto keluarga', 'Pilih satu foto keluarga atau teman. Rekam 45–60 detik menjelaskan siapa saja di foto itu dan hubungannya denganmu.', 'audio'),
  (4, 'Satu hari dalam hidupku', 'Tulis 6–8 kalimat tentang rutinitasmu dari pagi sampai malam. Gunakan minimal 3 kata always/usually/sometimes/never.', 'text'),
  (5, 'Dialog memesan makanan', 'Rekam dialog memesan makanan di kafe (boleh memerankan dua orang). Minimal 4 giliran bicara: sapaan, pesanan, harga, dan terima kasih.', 'audio'),
  (6, 'Petunjuk ke rumahku', 'Tulis petunjuk arah dari tempat umum terdekat ke rumah atau kantormu (5–7 kalimat) memakai go straight, turn left/right, dan next to/opposite.', 'text'),
  (7, 'Lima pertanyaan untuk teman baru', 'Tulis 5 pertanyaan yang ingin kamu tanyakan ke teman baru, lalu jawab sendiri kelima pertanyaan itu dengan kalimat lengkap.', 'text'),
  (8, 'Rekaman perkenalan akhir', 'Rekam perkenalan 1–2 menit: data diri, keluarga, rutinitas, dan hal yang kamu sukai. Bandingkan dengan rekaman sesi pertama, lalu tulis satu kalimat tentang perubahan yang kamu rasakan di kolom jawaban.', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum SpeakUp' from public.programs p
  where p.code = 'SU' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Breaking the ice', 'Siswa bisa membuka percakapan dengan orang baru dan menjaga obrolan tetap berjalan.', '• Pembuka percakapan sesuai situasi (kantor, acara, online).
• Follow-up question: What made you…? How long have you…?
• Baseline: percakapan 3 menit dengan tutor direkam sebagai pembanding.'),
  (2, 1, 'Keeping the conversation going', 'Siswa bisa memakai follow-up question dan backchannel agar percakapan tidak terhenti.', '• Backchannel: Really? I see. That sounds…
• Teknik ARE: Anchor, Reveal, Encourage.
• Menghindari jawaban satu kata; menambah detail dengan because, so, and then.'),
  (3, 2, 'Asking for clarification', 'Siswa bisa meminta pengulangan, penjelasan, dan mengecek pemahaman dengan sopan.', '• Sorry, could you say that again? What do you mean by…? Do you mean…?
• Mengecek pemahaman: So you''re saying…?
• Strategi saat tidak tahu kata: It''s a kind of…, It''s something you use to…'),
  (4, 2, 'Telling stories about the past', 'Siswa bisa menceritakan pengalaman masa lalu secara runtut.', '• Simple past (regular/irregular) dan past continuous untuk latar.
• Penanda urutan: first, then, after that, finally.
• Cek tengah program: tutor memberi catatan kelancaran dan akurasi.'),
  (5, 3, 'Opinions and agreeing politely', 'Siswa bisa menyampaikan pendapat, setuju, dan tidak setuju dengan sopan.', '• I think…, In my opinion…, I''m not sure, but…
• Setuju/tidak setuju: I see your point, but… I totally agree.
• Memberi alasan dan contoh.'),
  (6, 3, 'Making plans and invitations', 'Siswa bisa membuat, menerima, dan menolak ajakan serta menyusun rencana.', '• be going to dan present continuous untuk rencana.
• Ajakan: Would you like to…? How about…? Let''s…
• Menolak dengan sopan dan menawarkan alternatif.'),
  (7, 4, 'Handling difficult moments', 'Siswa bisa mengatasi jeda, lupa kata, dan mengalihkan topik dengan wajar.', '• Filler alami: Let me think…, Well…, How can I put it…
• Parafrasa saat lupa kata.
• Mengganti topik: By the way…, Speaking of…
• Simulasi percakapan 5 menit.'),
  (8, 4, 'Final conversation', 'Siswa mempertahankan percakapan 5 menit, bertanya balik, dan meminta klarifikasi.', '• Review strategi sesi 1–7.
• Assessment akhir: percakapan 5 menit dengan tutor, dinilai dengan rubrik yang sama seperti baseline.
• Refleksi dan rencana latihan mandiri.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekaman percakapan awal', 'Rekam dirimu menjawab 3 pertanyaan: Tell me about yourself. What do you do in your free time? What is one goal you have this year? Bicara 2–3 menit tanpa membaca naskah.', 'audio'),
  (2, 'Daftar follow-up question', 'Tulis 3 topik obrolan sehari-hari. Untuk tiap topik, tulis 1 pertanyaan pembuka dan 2 follow-up question.', 'text'),
  (3, 'Dialog salah paham', 'Rekam dialog singkat (boleh memerankan dua orang) di mana satu orang tidak paham dan meminta klarifikasi minimal 3 kali dengan ungkapan berbeda.', 'audio'),
  (4, 'Cerita pengalaman berkesan', 'Rekam cerita 1–2 menit tentang pengalaman berkesan (perjalanan, kejadian lucu, atau pencapaian) memakai minimal 3 penanda urutan.', 'audio'),
  (5, 'Pendapatku tentang…', 'Pilih satu topik (kerja dari rumah, media sosial, atau transportasi umum). Tulis 1 paragraf 80–120 kata berisi pendapat, 2 alasan, dan 1 contoh.', 'text'),
  (6, 'Pesan ajakan', 'Tulis pesan WhatsApp dalam bahasa Inggris untuk mengajak teman ke sebuah acara, lalu tulis balasan yang menolak dengan sopan dan menawarkan waktu lain.', 'text'),
  (7, 'Latihan 5 menit', 'Rekam dirimu berbicara 3–5 menit tentang topik pilihan tanpa berhenti lama. Gunakan filler dan parafrasa bila lupa kata.', 'audio'),
  (8, 'Rekaman percakapan akhir', 'Rekam jawabanmu untuk 3 pertanyaan yang sama seperti sesi pertama, 3–5 menit. Lalu tulis satu kalimat tentang perbedaan yang kamu rasakan.', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum English Circle' from public.programs p
  where p.code = 'EC' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Monthly kickoff: set your practice target', 'Siswa menentukan satu keterampilan fokus dan target praktik bulan ini.', '• Diskusi topik bulan ini dan pemanasan percakapan.
• Menentukan target SMART (misalnya: bicara 3 menit tanpa jeda panjang).
• Rekaman awal bulan sebagai pembanding.'),
  (2, 2, 'Discussion circle: current topics', 'Siswa berlatih berdiskusi dalam kelompok kecil tentang topik aktual.', '• Artikel/video pendek sebagai pemantik.
• Peran dalam diskusi: memulai, menanggapi, merangkum.
• Kosakata topik dan ungkapan diskusi.'),
  (3, 3, 'Focus skill workshop', 'Siswa memperbaiki keterampilan fokus masing-masing dengan latihan terarah.', '• Klinik pengucapan, kosakata, atau grammar sesuai kebutuhan kelompok.
• Koreksi langsung dari tutor dan latihan ulang.'),
  (4, 4, 'Monthly review', 'Siswa melihat kemajuan bulan ini dan menentukan target bulan berikutnya.', '• Rekaman akhir bulan dengan topik sebanding.
• Review tutor berdasarkan log praktik dan rekaman.
• Target bulan berikutnya.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Target dan rekaman awal bulan', 'Tulis target praktikmu bulan ini dalam 2–3 kalimat, lalu lampirkan rekaman 1–2 menit tentang topik bulan ini.', 'any'),
  (2, 'Log praktik minggu ini', 'Catat 3 aktivitas praktik bahasa Inggris yang kamu lakukan minggu ini (apa, berapa lama, apa yang sulit).', 'text'),
  (3, 'Latihan keterampilan fokus', 'Kerjakan latihan yang diberikan tutor untuk keterampilan fokusmu, lalu unggah hasilnya (rekaman atau tulisan).', 'any'),
  (4, 'Rekaman akhir bulan', 'Rekam 1–2 menit tentang topik bulan ini, lalu tulis apakah targetmu tercapai dan apa target bulan depan.', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum ScoreReady' from public.programs p
  where p.code = 'SR' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Diagnostic test & goal setting', 'Siswa mengetahui skor awal per bagian tes dan menetapkan target skor.', '• Simulasi diagnostik dengan format tes sasaran (TOEFL ITP/iBT atau IELTS).
• Penjelasan struktur tes dan sistem skor.
• Menetapkan target skor dan tanggal tes.'),
  (2, 1, 'Reading: skimming and scanning', 'Siswa bisa menemukan ide pokok dan informasi spesifik dengan cepat.', '• Skimming judul, kalimat topik, dan kesimpulan.
• Scanning kata kunci, angka, dan nama.
• Manajemen waktu per teks.'),
  (3, 2, 'Reading: inference and vocabulary in context', 'Siswa bisa menjawab soal inferensi dan menebak makna kata dari konteks.', '• Tipe soal inference, purpose, dan reference.
• Petunjuk konteks: definisi, contoh, kontras.
• Analisis jawaban pengecoh.'),
  (4, 2, 'Listening: main ideas and details', 'Siswa bisa menangkap ide pokok dan detail penting dari percakapan dan kuliah singkat.', '• Prediksi isi dari soal.
• Mencatat dengan singkatan dan simbol.
• Sinyal transisi dalam kuliah.'),
  (5, 3, 'Listening: attitude, purpose, and connections', 'Siswa bisa memahami sikap pembicara dan hubungan antar informasi.', '• Intonasi dan ungkapan sikap.
• Soal function: Why does the speaker say…?
• Mengorganisasi informasi dalam tabel.'),
  (6, 3, 'Structure & grammar for the test', 'Siswa menguasai pola grammar yang paling sering diuji.', '• Subject-verb agreement, tenses, clauses, parallel structure.
• Strategi menemukan kesalahan dengan cepat.'),
  (7, 4, 'Writing: task analysis and planning', 'Siswa bisa menganalisis soal writing dan menyusun kerangka dalam 5 menit.', '• Jenis soal writing pada tes sasaran.
• Thesis statement dan topic sentence.
• Kerangka paragraf PEEL.'),
  (8, 4, 'Writing: coherence and timed practice', 'Siswa menulis esai lengkap dalam batas waktu dengan alur yang runtut.', '• Kata penghubung dan kohesi.
• Variasi kalimat.
• Cek tengah program: simulasi writing berwaktu.'),
  (9, 5, 'Speaking: structuring quick answers', 'Siswa bisa menyusun jawaban speaking terstruktur dalam waktu persiapan singkat.', '• Template jawaban: point–reason–example–conclusion.
• Memanfaatkan waktu persiapan 15–60 detik.'),
  (10, 5, 'Speaking: integrated tasks', 'Siswa bisa merangkum bacaan/rekaman lalu menjawab secara lisan.', '• Mencatat poin kunci dari input.
• Parafrasa dan menghubungkan informasi.'),
  (11, 6, 'Vocabulary for academic topics', 'Siswa memperluas kosakata akademik yang sering muncul.', '• Academic Word List dan kolokasi.
• Word families dan sinonim untuk parafrasa.'),
  (12, 6, 'Full simulation 1', 'Siswa mengerjakan simulasi lengkap dengan kondisi mirip tes.', '• Simulasi penuh dengan waktu resmi.
• Pembahasan per bagian.'),
  (13, 7, 'Error clinic', 'Siswa memperbaiki pola kesalahan yang paling sering muncul.', '• Review kesalahan dari simulasi 1.
• Latihan ulang terarah per siswa.'),
  (14, 7, 'Time management & test-day strategy', 'Siswa punya strategi waktu dan kesiapan hari tes.', '• Alokasi waktu per bagian dan kapan melewati soal.
• Persiapan teknis dan mental hari tes.'),
  (15, 8, 'Full simulation 2', 'Siswa mengerjakan simulasi kedua sebagai latihan akhir.', '• Simulasi penuh dengan waktu resmi.
• Pembahasan singkat dan fokus terakhir.'),
  (16, 8, 'Final assessment & study plan', 'Siswa melihat perbandingan diagnostik awal dan simulasi akhir serta rencana belajar lanjutan.', '• Assessment akhir dengan format sebanding dengan diagnostik.
• Perbandingan per bagian dan rekomendasi.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Refleksi hasil diagnostik', 'Tulis skor/perkiraan per bagian dari simulasi diagnostik, bagian yang paling sulit, dan target skormu beserta tanggal tes yang direncanakan.', 'text'),
  (2, 'Latihan reading berwaktu', 'Kerjakan 1 set latihan reading berwaktu dari tutor. Unggah jawabanmu dan catat waktu yang kamu habiskan.', 'any'),
  (3, 'Analisis kesalahan reading', 'Pilih 5 soal reading yang kamu jawab salah. Untuk tiap soal, tulis mengapa jawabanmu salah dan petunjuk yang seharusnya kamu pakai.', 'text'),
  (4, 'Catatan listening', 'Dengarkan audio latihan dari tutor. Unggah catatanmu dan jawaban soal-soalnya.', 'any'),
  (5, 'Latihan listening lanjutan', 'Kerjakan set listening kedua dan tulis 3 kesalahan yang paling sering kamu buat serta strategi memperbaikinya.', 'any'),
  (6, 'Latihan structure', 'Kerjakan 25 soal structure dari tutor dan unggah jawabanmu.', 'any'),
  (7, 'Kerangka esai', 'Buat kerangka esai untuk soal latihan dari tutor: thesis, 2–3 ide pendukung, dan contoh untuk tiap ide.', 'text'),
  (8, 'Esai berwaktu', 'Tulis esai lengkap untuk soal dari tutor dalam waktu sesuai format tes (catat waktumu). Tempel teksnya atau unggah file.', 'any'),
  (9, 'Jawaban speaking terstruktur', 'Rekam jawabanmu untuk 2 soal speaking dari tutor, masing-masing sesuai batas waktu tes.', 'audio'),
  (10, 'Integrated speaking', 'Kerjakan 1 soal integrated speaking dari tutor dan unggah rekamanmu.', 'audio'),
  (11, 'Bank kosakata', 'Buat daftar 20 kata akademik baru beserta arti, contoh kalimat, dan satu sinonim.', 'text'),
  (12, 'Hasil simulasi 1', 'Tulis skor/perkiraan per bagian dari simulasi 1 dan bandingkan dengan diagnostik awal.', 'text'),
  (13, 'Rencana perbaikan', 'Tulis 3 pola kesalahan terbesarmu dan rencana latihan konkret untuk masing-masing selama 2 minggu ke depan.', 'text'),
  (14, 'Rencana hari tes', 'Tulis rencana hari tesmu: alokasi waktu per bagian, strategi bila kehabisan waktu, dan checklist persiapan.', 'text'),
  (15, 'Hasil simulasi 2', 'Tulis skor/perkiraan per bagian dari simulasi 2 dan bagian yang masih perlu dipoles.', 'text'),
  (16, 'Refleksi akhir', 'Tulis perbandingan skor awal dan akhirmu, bagian yang paling meningkat, dan rencana belajar sampai hari tes.', 'text')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum AcademicWrite' from public.programs p
  where p.code = 'AW' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Academic writing basics & diagnostic draft', 'Siswa memahami ciri tulisan akademik dan menulis draf diagnostik.', '• Perbedaan tulisan akademik dan populer: nada, struktur, bukti.
• Menulis draf diagnostik 300–400 kata sebagai pembanding.'),
  (2, 2, 'Thesis statements and outlines', 'Siswa bisa merumuskan thesis yang jelas dan kerangka esai yang logis.', '• Thesis: posisi + alasan utama.
• Kerangka: pendahuluan, isi, kesimpulan.
• Menguji thesis: apakah bisa diperdebatkan dan spesifik?'),
  (3, 3, 'Paragraph development', 'Siswa bisa mengembangkan paragraf dengan topic sentence, bukti, dan analisis.', '• Struktur PEEL.
• Jenis bukti: data, contoh, kutipan ahli.
• Analisis: menjelaskan mengapa bukti mendukung klaim.'),
  (4, 3, 'Paraphrasing and summarizing', 'Siswa bisa memparafrasa dan meringkas sumber tanpa plagiarisme.', '• Teknik parafrasa: sinonim, ubah struktur, ubah kelas kata.
• Ringkasan: ide pokok tanpa detail.
• Cek tengah program: catatan tutor atas draf.'),
  (5, 4, 'Citations and referencing', 'Siswa bisa mencantumkan sitasi dan daftar pustaka dengan gaya yang konsisten (APA 7).', '• Sitasi dalam teks: parenthetical dan narrative.
• Daftar pustaka untuk jurnal, buku, dan situs web.
• Alat bantu referensi dan pengecekan manual.'),
  (6, 5, 'Cohesion, hedging, and academic style', 'Siswa bisa menulis dengan alur yang runtut dan gaya akademik yang tepat.', '• Transisi antarparagraf.
• Hedging: may, suggests, it appears that.
• Menghindari bahasa lisan dan generalisasi berlebihan.'),
  (7, 6, 'Peer review and revision', 'Siswa bisa memberi dan menerima masukan, lalu merevisi secara terarah.', '• Checklist review: thesis, struktur, bukti, sitasi, bahasa.
• Menyusun catatan revisi.'),
  (8, 6, 'Final essay submission & review', 'Siswa menyerahkan esai final 500–700 kata dengan sitasi, parafrasa, dan struktur yang valid.', '• Pengecekan akhir dan proofreading.
• Assessment akhir: esai final dibandingkan draf diagnostik dengan rubrik yang sama.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Draf diagnostik', 'Tulis esai 300–400 kata untuk prompt dari tutor tanpa bantuan alat penulisan. Unggah file atau tempel teksnya.', 'any'),
  (2, 'Thesis dan kerangka', 'Tulis thesis statement dan kerangka lengkap untuk topik esai akhirmu.', 'text'),
  (3, 'Dua paragraf isi', 'Tulis 2 paragraf isi (masing-masing 120–170 kata) untuk esai akhirmu memakai struktur PEEL.', 'any'),
  (4, 'Latihan parafrasa', 'Parafrasakan 3 kutipan dari sumber yang diberikan tutor, lalu tulis ringkasan 60–80 kata dari salah satu sumber.', 'text'),
  (5, 'Daftar pustaka', 'Buat daftar pustaka APA 7 untuk minimal 4 sumber esaimu dan tunjukkan 2 contoh sitasi dalam teks.', 'text'),
  (6, 'Draf lengkap', 'Unggah draf lengkap esaimu (500–700 kata) dengan sitasi.', 'file'),
  (7, 'Catatan revisi', 'Tulis catatan revisi: 5 perubahan yang akan kamu lakukan pada drafmu berdasarkan masukan tutor dan teman, beserta alasannya.', 'text'),
  (8, 'Esai final', 'Unggah esai final (500–700 kata) lengkap dengan daftar pustaka.', 'file')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum ScholarSpeak' from public.programs p
  where p.code = 'SS' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Scholarship interviews: what panels look for', 'Siswa memahami kriteria panel dan merekam jawaban awal.', '• Kriteria umum: motivasi, kecocokan program, kontribusi, kesiapan.
• Baseline: jawaban Tell me about yourself direkam sebagai pembanding.'),
  (2, 1, 'Telling your story', 'Siswa bisa menyusun narasi personal yang fokus dan meyakinkan.', '• Struktur Past–Present–Future.
• Memilih pengalaman yang relevan dengan tujuan studi.'),
  (3, 2, 'Motivation and study plan', 'Siswa bisa menjelaskan alasan memilih program/kampus dan rencana studi.', '• Why this program? Why this university? Why now?
• Menghubungkan rencana studi dengan tujuan karier.'),
  (4, 2, 'Contribution and impact', 'Siswa bisa menjelaskan kontribusi setelah studi secara konkret.', '• Rencana kontribusi jangka pendek dan panjang.
• Memberi bukti kemampuan dari pengalaman sebelumnya.
• Cek tengah program: mock interview singkat.'),
  (5, 3, 'STAR answers for behavioral questions', 'Siswa bisa menjawab pertanyaan perilaku dengan metode STAR.', '• Situation, Task, Action, Result.
• Pertanyaan umum: leadership, failure, conflict, teamwork.'),
  (6, 3, 'Handling tough and unexpected questions', 'Siswa bisa merespons pertanyaan sulit dengan tenang dan terstruktur.', '• Membeli waktu dengan wajar: That''s an interesting question…
• Menjawab kelemahan dengan jujur dan solutif.'),
  (7, 4, 'Delivery: voice, pace, and presence', 'Siswa bisa menyampaikan jawaban dengan intonasi, tempo, dan bahasa tubuh yang meyakinkan.', '• Intonasi untuk penekanan, jeda yang efektif.
• Kontak mata dan postur di wawancara online.'),
  (8, 4, 'Final mock interview', 'Siswa menjalani simulasi wawancara beasiswa lengkap.', '• Mock interview 10–15 menit dengan panel tutor.
• Assessment akhir dengan rubrik yang sama seperti baseline.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekaman jawaban awal', 'Rekam jawaban 1–2 menit untuk pertanyaan: Tell us about yourself and why you are applying for this scholarship.', 'audio'),
  (2, 'Narasi personal', 'Tulis kerangka narasi personalmu (Past–Present–Future) dalam 150–200 kata.', 'text'),
  (3, 'Jawaban motivasi', 'Rekam jawabanmu untuk: Why did you choose this program and university? (1–2 menit).', 'audio'),
  (4, 'Rencana kontribusi', 'Tulis rencana kontribusimu setelah studi (100–150 kata) dengan satu contoh konkret.', 'text'),
  (5, 'Dua jawaban STAR', 'Rekam 2 jawaban STAR untuk pertanyaan tentang kepemimpinan dan kegagalan (masing-masing 1–2 menit).', 'audio'),
  (6, 'Pertanyaan sulit', 'Tulis jawaban singkat untuk 3 pertanyaan sulit: kelemahan terbesarmu, jika tidak lolos beasiswa, dan hal yang membedakanmu dari pelamar lain.', 'text'),
  (7, 'Mock interview rekaman', 'Rekam mock interview mandiri 5 menit menjawab 3 pertanyaan pilihan dari daftar tutor.', 'audio'),
  (8, 'Kerangka jawaban final', 'Unggah kerangka jawaban terstruktur untuk 5 pertanyaan inti wawancaramu (boleh file atau teks).', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum LitLab' from public.programs p
  where p.code = 'LL' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Reading like a critic', 'Siswa mengenal unsur cerita dan menulis tanggapan awal.', '• Unsur cerita: tokoh, latar, alur, konflik, tema.
• Membaca cerpen pendek bersama dan diskusi.
• Baseline: tanggapan tertulis singkat.'),
  (2, 2, 'Characters and themes', 'Siswa bisa menganalisis tokoh dan tema dengan bukti dari teks.', '• Karakterisasi langsung dan tidak langsung.
• Menemukan tema dan mendukungnya dengan kutipan.
• Diskusi kelompok terekam.'),
  (3, 3, 'Film and story comparison', 'Siswa bisa membandingkan versi cerita di buku dan film.', '• Kosakata ulasan: plot, pacing, cinematography, adaptation.
• Membandingkan dan mengontraskan: whereas, similarly, on the other hand.'),
  (4, 4, 'Writing a structured review', 'Siswa menyusun ulasan 200–300 kata yang terstruktur.', '• Struktur ulasan: pengantar, ringkasan tanpa spoiler, analisis, rekomendasi.
• Assessment akhir: ulasan dibandingkan tanggapan awal.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Tanggapan awal', 'Tulis tanggapan 100–150 kata tentang cerpen yang dibahas: bagian favoritmu dan alasannya.', 'text'),
  (2, 'Analisis tokoh', 'Pilih satu tokoh dari teks/film yang dibahas. Tulis 2 paragraf tentang perubahan tokoh itu dengan 2 kutipan pendukung.', 'text'),
  (3, 'Rekaman diskusi', 'Rekam pendapatmu 1–2 menit: versi mana yang lebih kuat (buku atau film) dan mengapa.', 'audio'),
  (4, 'Ulasan final', 'Tulis ulasan 200–300 kata tentang buku atau film pilihan dengan struktur yang dipelajari.', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum LittleLingo' from public.programs p
  where p.code = 'LIL' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Hello, friends!', 'Anak bisa menyapa dan menyebut nama serta umur.', '• Lagu sapaan dan permainan nama.
• Hello! What''s your name? I''m… How old are you? I''m seven.
• Baseline: video singkat anak memperkenalkan diri.'),
  (2, 1, 'Colors and shapes', 'Anak bisa menyebut warna dan bentuk dasar.', '• red, blue, yellow, green; circle, square, triangle.
• Permainan tunjuk dan sebut, mewarnai.'),
  (3, 2, 'My family', 'Anak bisa memperkenalkan anggota keluarga.', '• mommy, daddy, brother, sister, grandma, grandpa.
• This is my…
• Menggambar keluarga.'),
  (4, 2, 'Animals', 'Anak mengenal hewan dan suaranya serta bisa berkata I like…', '• dog, cat, bird, fish, cow, chicken.
• What''s this? It''s a… I like cats.
• Permainan tebak suara hewan.'),
  (5, 3, 'Food I like', 'Anak bisa menyebut makanan dan menyatakan suka/tidak suka.', '• apple, banana, rice, milk, bread, egg.
• I like… I don''t like…
• Cek tengah program: tutor mencatat kemajuan anak.'),
  (6, 3, 'Toys and classroom things', 'Anak bisa menyebut mainan dan benda kelas serta jumlahnya.', '• ball, doll, car, book, pencil, bag.
• Angka 1–10: I have two pencils.'),
  (7, 4, 'Actions and instructions', 'Anak bisa mengikuti instruksi sederhana dari tutor.', '• stand up, sit down, jump, clap, touch your nose.
• Permainan Simon Says.'),
  (8, 4, 'Show and tell', 'Anak memperkenalkan diri dan satu benda favorit di depan kelas.', '• Rangkuman kosakata sesi 1–7.
• Assessment akhir: perkenalan dan show and tell dibandingkan video awal.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Video perkenalan', 'Bantu anak merekam video atau suara 20–40 detik: menyapa, menyebut nama, dan umur dalam bahasa Inggris.', 'any'),
  (2, 'Berburu warna', 'Ajak anak mencari 5 benda di rumah, lalu rekam anak menyebut warna dan benda itu (contoh: a red ball).', 'audio'),
  (3, 'Gambar keluargaku', 'Unggah foto gambar keluarga buatan anak, dan bila bisa rekam anak menyebut tiap anggota keluarga (This is my…).', 'any'),
  (4, 'Hewan favorit', 'Rekam anak menyebut hewan favoritnya dan satu kalimat I like…', 'audio'),
  (5, 'Piring makan siangku', 'Unggah foto makan siang anak dan rekam anak menyebut makanannya dengan I like…', 'any'),
  (6, 'Menghitung mainan', 'Rekam anak menghitung mainannya dan menyebut namanya (contoh: I have three cars).', 'audio'),
  (7, 'Simon Says di rumah', 'Mainkan Simon Says bersama anak dengan 5 instruksi, lalu rekam video atau suara anak mengikuti dan mengucapkannya.', 'any'),
  (8, 'Video show and tell', 'Rekam video atau suara anak 30–60 detik: memperkenalkan diri dan menunjukkan satu benda favorit (This is my…, It''s…, I like it).', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum TeenTalk' from public.programs p
  where p.code = 'TT' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Me in 60 seconds', 'Siswa bisa memperkenalkan diri dengan percaya diri selama 1 menit.', '• Struktur perkenalan menarik: hook, fakta tentang diri, hobi.
• Baseline: rekaman perkenalan 1 menit.'),
  (2, 1, 'Hobbies and interests', 'Siswa bisa membicarakan hobi dengan detail dan alasan.', '• Kosakata hobi dan frekuensi.
• I''m into…, I''m good at…, because…'),
  (3, 2, 'Opinions and reasons', 'Siswa bisa menyampaikan pendapat dengan alasan sederhana.', '• I think…, I believe…, because…, for example…
• Debat ringan tentang topik remaja.'),
  (4, 2, 'Planning a short presentation', 'Siswa bisa menyusun presentasi 3 menit dengan pembuka, isi, dan penutup.', '• Struktur presentasi dan signposting: First…, Next…, To sum up…
• Cek tengah program: catatan tutor.'),
  (5, 3, 'Using visuals', 'Siswa bisa membuat slide sederhana yang mendukung presentasi.', '• Prinsip slide: satu ide per slide, gambar, sedikit teks.
• Menjelaskan gambar: As you can see…'),
  (6, 3, 'Voice and confidence', 'Siswa bisa berbicara dengan volume, tempo, dan kontak mata yang baik.', '• Latihan pernapasan dan tempo.
• Mengatasi gugup.'),
  (7, 4, 'Answering questions', 'Siswa bisa merespons pertanyaan audiens dengan sederhana.', '• That''s a good question…, I think…, I''m not sure, but…
• Latihan tanya jawab berpasangan.'),
  (8, 4, 'Final presentation day', 'Siswa menyampaikan presentasi 3 menit dan menjawab pertanyaan dengan percaya diri.', '• Presentasi final dan sesi tanya jawab.
• Assessment akhir dibandingkan rekaman perkenalan awal.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekaman perkenalan', 'Rekam perkenalan 1 menit tentang dirimu: sekolah, hobi, dan satu fakta unik.', 'audio'),
  (2, 'Hobiku', 'Tulis 1 paragraf 80–100 kata tentang hobimu: sejak kapan, seberapa sering, dan mengapa kamu menyukainya.', 'text'),
  (3, 'Pendapat singkat', 'Rekam pendapatmu 1 menit tentang topik: Should students use phones at school?', 'audio'),
  (4, 'Kerangka presentasi', 'Tulis kerangka presentasi 3 menit tentang topik pilihan: pembuka, 3 poin isi, dan penutup.', 'text'),
  (5, 'Slide presentasi', 'Unggah 3–5 slide (PDF atau gambar) untuk presentasimu.', 'file'),
  (6, 'Latihan presentasi', 'Rekam latihan presentasimu (minimal 2 menit).', 'audio'),
  (7, 'Jawaban pertanyaan', 'Tulis 3 pertanyaan yang mungkin ditanyakan audiens tentang presentasimu beserta jawabanmu.', 'text'),
  (8, 'Rekaman presentasi final', 'Unggah rekaman presentasi final 3 menit (audio atau video).', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum English for Career' from public.programs p
  where p.code = 'EFC' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Career goals and interview baseline', 'Siswa menentukan posisi sasaran dan merekam jawaban wawancara awal.', '• Memetakan posisi sasaran dan kompetensi yang dicari.
• Baseline: jawaban Tell me about yourself direkam.'),
  (2, 1, 'CV and LinkedIn language', 'Siswa bisa menulis ringkasan profesional dan poin pengalaman dengan kata kerja aksi.', '• Action verbs: managed, improved, coordinated.
• Menulis pencapaian dengan angka.'),
  (3, 2, 'Tell me about yourself', 'Siswa menyusun jawaban perkenalan 60–90 detik yang relevan dengan posisi.', '• Formula Present–Past–Future.
• Menyesuaikan jawaban dengan deskripsi pekerjaan.'),
  (4, 2, 'Strengths, weaknesses, and motivation', 'Siswa bisa menjawab pertanyaan kekuatan, kelemahan, dan motivasi dengan jujur dan meyakinkan.', '• Menyebut kekuatan dengan bukti.
• Kelemahan dan langkah perbaikan.
• Cek tengah program: catatan tutor.'),
  (5, 3, 'Behavioral questions with STAR', 'Siswa bisa menjawab pertanyaan perilaku dengan metode STAR.', '• Situation, Task, Action, Result.
• Pertanyaan umum: conflict, deadline, teamwork.'),
  (6, 3, 'Asking questions and salary talk', 'Siswa bisa mengajukan pertanyaan ke pewawancara dan membicarakan ekspektasi gaji dengan sopan.', '• Pertanyaan cerdas untuk pewawancara.
• Ungkapan negosiasi: My expectation is in the range of…'),
  (7, 4, 'Online interview etiquette', 'Siswa siap mengikuti wawancara online secara profesional.', '• Persiapan teknis, latar, dan pencahayaan.
• Pembukaan dan penutupan wawancara.
• Email ucapan terima kasih.'),
  (8, 4, 'Final mock interview', 'Siswa menjalani simulasi wawancara kerja 10–15 menit untuk posisi sasaran.', '• Mock interview lengkap dengan tutor.
• Assessment akhir dibandingkan jawaban awal.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekaman jawaban awal', 'Rekam jawaban 1–2 menit untuk: Tell me about yourself, untuk posisi yang kamu incar.', 'audio'),
  (2, 'Ringkasan profesional', 'Tulis ringkasan profesional 3–4 kalimat dan 3 poin pengalaman kerja dengan action verbs.', 'text'),
  (3, 'Jawaban perkenalan', 'Rekam versi perbaikan jawaban Tell me about yourself (60–90 detik).', 'audio'),
  (4, 'Jawaban tertulis', 'Tulis jawabanmu untuk: What are your strengths? What is your weakness? Why do you want this job?', 'text'),
  (5, 'Dua jawaban STAR', 'Rekam 2 jawaban STAR (masing-masing 1–2 menit) untuk pertanyaan tentang konflik dan tenggat ketat.', 'audio'),
  (6, 'Pertanyaan untuk pewawancara', 'Tulis 4 pertanyaan yang akan kamu ajukan ke pewawancara dan satu jawaban tentang ekspektasi gaji.', 'text'),
  (7, 'Email terima kasih', 'Tulis email ucapan terima kasih setelah wawancara (80–120 kata).', 'text'),
  (8, 'Refleksi mock interview', 'Tulis 3 hal yang sudah kamu lakukan dengan baik dan 2 hal yang akan kamu perbaiki untuk wawancara sungguhan.', 'text')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum ServiceEnglish' from public.programs p
  where p.code = 'SE' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Service mindset and greeting guests', 'Siswa bisa menyambut tamu/pelanggan dengan ramah dan profesional.', '• Sapaan layanan: Good morning, welcome to… How may I help you?
• Nada suara dan bahasa tubuh.
• Baseline: role-play penyambutan direkam.'),
  (2, 1, 'Hospitality: check-in and check-out', 'Siswa bisa melayani proses check-in dan check-out hotel.', '• Kosakata: reservation, ID, deposit, key card, invoice.
• Alur percakapan check-in/out.'),
  (3, 2, 'F&B: taking orders and recommendations', 'Siswa bisa mencatat pesanan dan memberi rekomendasi menu.', '• Are you ready to order? I''d recommend…, It comes with…
• Menjelaskan bahan dan rasa.'),
  (4, 2, 'Giving information and directions', 'Siswa bisa memberi informasi fasilitas dan petunjuk arah dengan jelas.', '• Fasilitas, jam operasional, lokasi.
• Cek tengah program: catatan tutor.'),
  (5, 3, 'Handling complaints (LEARN)', 'Siswa bisa menangani keluhan dengan langkah Listen–Empathize–Apologize–Resolve–Notify.', '• Ungkapan empati dan permintaan maaf.
• Menawarkan solusi dan tindak lanjut.'),
  (6, 3, 'Phone and chat etiquette', 'Siswa bisa melayani telepon dan pesan chat dengan profesional.', '• Membuka/menutup telepon, menahan dan memindahkan panggilan.
• Template balasan chat.'),
  (7, 4, 'Upselling and closing', 'Siswa bisa menawarkan produk tambahan dan menutup layanan dengan baik.', '• Would you like to upgrade…? We also have…
• Penutup: Is there anything else I can help you with?'),
  (8, 4, 'Final scenarios', 'Siswa menyelesaikan 4 skenario layanan: hospitality, F&B, informasi, dan keluhan.', '• Role-play skenario dengan checklist standar layanan.
• Assessment akhir dibandingkan rekaman awal.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekaman penyambutan', 'Rekam role-play menyambut pelanggan di tempat kerjamu (atau tempat pilihan) selama 1 menit.', 'audio'),
  (2, 'Skrip check-in', 'Tulis skrip dialog check-in hotel (minimal 8 giliran bicara).', 'text'),
  (3, 'Role-play pesanan', 'Rekam role-play mencatat pesanan dan memberi 2 rekomendasi menu.', 'audio'),
  (4, 'Informasi fasilitas', 'Tulis penjelasan 5–7 kalimat tentang fasilitas dan jam operasional tempat kerjamu untuk tamu asing.', 'text'),
  (5, 'Role-play keluhan', 'Rekam role-play menangani keluhan pelanggan (1–2 menit) dengan langkah LEARN.', 'audio'),
  (6, 'Balasan chat', 'Tulis balasan chat profesional untuk 2 pesan pelanggan yang diberikan tutor.', 'text'),
  (7, 'Role-play upselling', 'Rekam role-play menawarkan upgrade atau produk tambahan kepada pelanggan.', 'audio'),
  (8, 'Checklist layanan', 'Isi checklist standar layananmu: tulis 1 hal yang sudah konsisten kamu lakukan dan 1 yang perlu dilatih untuk tiap skenario.', 'text')
) as v(seq, title, instructions, type) on v.seq = mods.seq;

with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, 'Kurikulum SpeakStage' from public.programs p
  where p.code = 'SST' and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content from c, (values
  (1, 1, 'Presentation baseline', 'Siswa merekam presentasi singkat sebagai pembanding.', '• Kriteria presentasi bisnis yang efektif.
• Baseline: presentasi 2 menit tentang pekerjaan atau proyek.'),
  (2, 1, 'Structuring your message', 'Siswa bisa menyusun pesan inti dengan struktur yang jelas.', '• Pyramid principle: pesan utama di awal.
• Struktur problem–solution–benefit.'),
  (3, 2, 'Openings and closings', 'Siswa bisa membuka dan menutup presentasi dengan kuat.', '• Pembuka: pertanyaan, data, cerita singkat.
• Penutup: ringkasan dan call to action.'),
  (4, 2, 'Describing data and visuals', 'Siswa bisa menjelaskan grafik dan data dengan tepat.', '• Kosakata tren: increase, decline, peak, remain stable.
• As you can see…, This chart shows…
• Cek tengah program: catatan tutor.'),
  (5, 3, 'Delivery and body language', 'Siswa bisa menyampaikan presentasi dengan suara, jeda, dan bahasa tubuh yang meyakinkan.', '• Penekanan kata, jeda, tempo.
• Gestur dan kontak mata (offline/online).'),
  (6, 3, 'Handling Q&A and critical questions', 'Siswa bisa menjawab pertanyaan kritis dengan tenang dan terstruktur.', '• Teknik: acknowledge–answer–bridge.
• Menjawab saat tidak tahu jawabannya.'),
  (7, 4, 'Rehearsal with feedback', 'Siswa melakukan gladi presentasi lengkap dan memperbaikinya.', '• Gladi 5 menit di depan kelas.
• Masukan tutor dan teman.'),
  (8, 4, 'Final presentation', 'Siswa menyampaikan presentasi bisnis 5 menit dan menjawab 2 pertanyaan kritis.', '• Presentasi final dan sesi tanya jawab.
• Assessment akhir dibandingkan rekaman awal.')
  ) as v(seq, week, title, objectives, content)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
  (1, 'Rekaman presentasi awal', 'Rekam presentasi 2 menit tentang pekerjaanmu atau satu proyek yang sedang kamu kerjakan.', 'any'),
  (2, 'Kerangka pesan', 'Tulis kerangka presentasi 5 menit: pesan utama, 3 poin pendukung, dan ajakan bertindak.', 'text'),
  (3, 'Pembuka dan penutup', 'Rekam pembuka (30 detik) dan penutup (30 detik) presentasimu.', 'audio'),
  (4, 'Menjelaskan grafik', 'Tulis penjelasan 80–100 kata untuk satu grafik dari pekerjaanmu atau yang diberikan tutor.', 'text'),
  (5, 'Latihan penyampaian', 'Rekam latihan presentasi 3 menit dengan fokus pada jeda dan penekanan.', 'any'),
  (6, 'Antisipasi pertanyaan', 'Tulis 3 pertanyaan kritis yang mungkin muncul dari presentasimu beserta jawaban singkatnya.', 'text'),
  (7, 'Slide final', 'Unggah slide final presentasimu (PDF).', 'file'),
  (8, 'Rekaman presentasi final', 'Unggah rekaman presentasi final 5 menit (audio atau video).', 'any')
) as v(seq, title, instructions, type) on v.seq = mods.seq;
