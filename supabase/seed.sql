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
