// Draf awal bank soal placement test. Academic Lead meninjau dan mengubahnya
// dari portal (menu Bank Soal Placement). Soal listening memakai naskah
// (passage) yang dibacakan suara browser sampai Lead mengunggah audio asli.

export type Section = "grammar" | "reading" | "listening" | "writing" | "speaking";

export type BankQuestion = {
  section: Section;
  group_key?: string;
  passage?: string;
  prompt: string;
  options?: string[];
  answer_index?: number;
  cefr?: "A1" | "A2" | "B1" | "B2";
  sort_order: number;
};

const READING_A2 = `Hi Dina,

Thanks for asking about the English Club. We meet every Tuesday from 7 to 8:30 p.m. in Room 4 on the second floor of the library. Each week we choose a topic, like food or travel, and talk in small groups. You don't need to pay, but please bring a notebook. Next week is a little different: we will meet on Wednesday because the library is closed on Tuesday for cleaning.

See you there,
Rina`;

const READING_B1 = `Many people believe that learning a language is mostly about memorising words. However, research on language learning suggests that regular speaking practice matters just as much. Learners who talk for even ten minutes a day often become more confident than those who study vocabulary lists for an hour. The reason is simple: speaking forces the brain to find words quickly and put them into sentences. Mistakes are a normal part of this process. In fact, teachers say that students who are afraid of making mistakes usually improve more slowly, because they avoid the practice they need most.`;

const LISTENING_A2 = `Woman: Good evening, Bella Cafe. How can I help you?
Man: Hi, I'd like to book a table for four people on Saturday, please.
Woman: Sure. What time would you like?
Man: Around seven in the evening.
Woman: I'm sorry, seven is full. We have a table at half past seven.
Man: That's fine. Can we sit outside?
Woman: Yes, there's one table left on the terrace. Can I have your name?
Man: It's Arif. A-R-I-F.`;

const LISTENING_B1 = `Attention, please. This is an announcement for passengers travelling to Bandung. The 10:15 train will now depart from platform 6, not platform 3. Because of maintenance work on the line, the journey will take about twenty minutes longer than usual. Passengers are reminded that food and drinks are available in carriage 4. We apologise for any inconvenience.`;

export const PLACEMENT_BANK: BankQuestion[] = [
  // Grammar
  { section: "grammar", cefr: "A1", sort_order: 1, prompt: "She ___ a teacher at a primary school.", options: ["am", "is", "are", "be"], answer_index: 1 },
  { section: "grammar", cefr: "A1", sort_order: 2, prompt: "I ___ coffee every morning before work.", options: ["drink", "drinks", "drinking", "am drink"], answer_index: 0 },
  { section: "grammar", cefr: "A1", sort_order: 3, prompt: "There ___ two books on the table.", options: ["is", "are", "be", "am"], answer_index: 1 },
  { section: "grammar", cefr: "A2", sort_order: 4, prompt: "Yesterday we ___ to the beach with our friends.", options: ["go", "goes", "went", "gone"], answer_index: 2 },
  { section: "grammar", cefr: "A2", sort_order: 5, prompt: "This bag is ___ than the black one.", options: ["expensive", "more expensive", "most expensive", "expensiver"], answer_index: 1 },
  { section: "grammar", cefr: "A2", sort_order: 6, prompt: "Have you ever ___ Japanese food?", options: ["eat", "ate", "eaten", "eating"], answer_index: 2 },
  { section: "grammar", cefr: "B1", sort_order: 7, prompt: "If it rains tomorrow, we ___ at home.", options: ["stay", "will stay", "would stay", "stayed"], answer_index: 1 },
  { section: "grammar", cefr: "B1", sort_order: 8, prompt: "I have been living in this city ___ 2019.", options: ["for", "since", "from", "during"], answer_index: 1 },
  { section: "grammar", cefr: "B1", sort_order: 9, prompt: "The report ___ by the manager last week.", options: ["wrote", "was written", "has written", "is writing"], answer_index: 1 },
  { section: "grammar", cefr: "B2", sort_order: 10, prompt: "If I ___ about the traffic, I would have left earlier.", options: ["knew", "had known", "have known", "would know"], answer_index: 1 },
  { section: "grammar", cefr: "B2", sort_order: 11, prompt: "She suggested ___ the meeting until Friday.", options: ["to postpone", "postponing", "postpone", "postponed"], answer_index: 1 },
  { section: "grammar", cefr: "B2", sort_order: 12, prompt: "Hardly ___ the station when the train left.", options: ["I had reached", "had I reached", "I reached", "did I reached"], answer_index: 1 },

  // Reading
  { section: "reading", group_key: "reading-club", passage: READING_A2, cefr: "A2", sort_order: 13, prompt: "How often does the English Club meet?", options: ["Every day", "Once a week", "Twice a week", "Once a month"], answer_index: 1 },
  { section: "reading", group_key: "reading-club", passage: READING_A2, cefr: "A2", sort_order: 14, prompt: "Where does the club meet?", options: ["In a cafe", "In Rina's house", "In the library", "In a school hall"], answer_index: 2 },
  { section: "reading", group_key: "reading-club", passage: READING_A2, cefr: "A2", sort_order: 15, prompt: "What should Dina bring?", options: ["Money", "A notebook", "Food", "A dictionary"], answer_index: 1 },
  { section: "reading", group_key: "reading-club", passage: READING_A2, cefr: "A2", sort_order: 16, prompt: "Why is next week's meeting on Wednesday?", options: ["The teacher is busy", "Tuesday is a holiday", "The library is closed on Tuesday", "The room is too small"], answer_index: 2 },
  { section: "reading", group_key: "reading-speaking", passage: READING_B1, cefr: "B1", sort_order: 17, prompt: "What is the main idea of the text?", options: ["Vocabulary lists are the best way to learn", "Regular speaking practice is very important", "Teachers should correct every mistake", "Learning a language takes many years"], answer_index: 1 },
  { section: "reading", group_key: "reading-speaking", passage: READING_B1, cefr: "B1", sort_order: 18, prompt: "According to the text, learners who speak ten minutes a day often…", options: ["forget more words", "become more confident", "make fewer mistakes", "study for an hour"], answer_index: 1 },
  { section: "reading", group_key: "reading-speaking", passage: READING_B1, cefr: "B2", sort_order: 19, prompt: "Why does speaking help, according to the writer?", options: ["It is more fun than reading", "It makes learners find words and build sentences quickly", "It replaces grammar study", "Teachers prefer it"], answer_index: 1 },
  { section: "reading", group_key: "reading-speaking", passage: READING_B1, cefr: "B2", sort_order: 20, prompt: "What does the writer imply about students who fear mistakes?", options: ["They learn faster", "They speak more often", "They miss the practice they need", "They should study vocabulary first"], answer_index: 2 },

  // Listening
  { section: "listening", group_key: "listening-cafe", passage: LISTENING_A2, cefr: "A2", sort_order: 21, prompt: "How many people is the table for?", options: ["Two", "Three", "Four", "Five"], answer_index: 2 },
  { section: "listening", group_key: "listening-cafe", passage: LISTENING_A2, cefr: "A2", sort_order: 22, prompt: "What time is the booking?", options: ["6:30", "7:00", "7:30", "8:00"], answer_index: 2 },
  { section: "listening", group_key: "listening-cafe", passage: LISTENING_A2, cefr: "A2", sort_order: 23, prompt: "Where will they sit?", options: ["Inside, near the window", "On the terrace", "At the bar", "In a private room"], answer_index: 1 },
  { section: "listening", group_key: "listening-train", passage: LISTENING_B1, cefr: "B1", sort_order: 24, prompt: "Which platform will the train leave from?", options: ["Platform 3", "Platform 4", "Platform 6", "Platform 10"], answer_index: 2 },
  { section: "listening", group_key: "listening-train", passage: LISTENING_B1, cefr: "B1", sort_order: 25, prompt: "Why will the journey take longer?", options: ["Bad weather", "Maintenance work on the line", "A late driver", "Too many passengers"], answer_index: 1 },
  { section: "listening", group_key: "listening-train", passage: LISTENING_B1, cefr: "B1", sort_order: 26, prompt: "Where can passengers buy food?", options: ["On platform 6", "In carriage 4", "At the ticket office", "Nowhere on the train"], answer_index: 1 },

  // Writing
  {
    section: "writing",
    sort_order: 27,
    prompt:
      "Write 80–120 words in English. Describe your usual day and explain why you want to improve your English. (Tulis 80–120 kata dalam bahasa Inggris tentang kegiatan harianmu dan alasan kamu ingin meningkatkan bahasa Inggris.)",
  },

  // Speaking
  {
    section: "speaking",
    sort_order: 28,
    prompt: "Introduce yourself: your name, where you live, and what you do every day. (Perkenalkan diri sekitar 1 menit.)",
  },
  {
    section: "speaking",
    sort_order: 29,
    prompt: "Tell us about a memorable experience in your life and explain why it was important to you. (Ceritakan sekitar 1–2 menit.)",
  },
];
