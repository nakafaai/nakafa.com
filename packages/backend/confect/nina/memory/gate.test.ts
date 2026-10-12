import { describe, expect, it } from "@effect/vitest";
import { passesGate } from "@repo/backend/confect/nina/memory/gate";
import { Array as Arr } from "effect";

/** Labelled messages: whether a learner speaks about themself in a message long enough to hold a memory. */
const messages = [
  // Indonesian: first-person words
  ["Aku kelas 12 dan mau ikut SNBT 2027", true],
  ["Saya sedang belajar untuk UTBK minggu depan", true],
  ["Sy kelas 11 IPS di Bandung", true],
  ["Gue susah banget ngerti trigonometri", true],
  ["Gua mau masuk ITB tahun depan", true],
  ["gw lebih suka belajar pakai contoh soal", true],
  ["AKU KELAS DUA BELAS SMA", true],
  // Indonesian: the suffix -ku and the prefix ku-
  ["Kelasku sedang ulangan kimia hari Senin", true],
  ["Targetku masuk UI jurusan hukum", true],
  ["Nilai matematikaku masih jelek sekali", true],
  ["Bukuku tertinggal jadi tidak bisa mengerjakan", true],
  ["Kupikir logaritma itu sulit sekali", true],
  ["Kuingin lulus dengan nilai terbaik", true],
  // Indonesian: plain questions and words that only look like a marker
  ["Apa itu turunan fungsi trigonometri?", false],
  ["Jelaskan hukum Newton tentang gerak", false],
  ["Bagaimana cara menyelesaikan persamaan kuadrat?", false],
  ["Tolong jelaskan bab tentang suku banyak", false],
  ["Cari buku latihan soal integral dong", false],
  ["Mengapa otot menjadi kaku setelah olahraga?", false],
  ["Apa itu pengakuan kedaulatan negara?", false],
  ["Bagaimana permukaan bumi terbentuk lama sekali?", false],
  ["Apa fungsi mitokondria pada sel hewan?", false],
  ["Siapa penemu teori relativitas umum itu?", false],
  // English: first-person words
  ["I am in grade 12 and preparing for SNBT", true],
  ["I'm struggling with trigonometric identities", true],
  ["My exam is on October 20 so help", true],
  ["Please help me understand derivatives", true],
  ["i prefer worked examples before formulas", true],
  ["I’m aiming for ITB next year", true],
  ["Learning by myself is hard for algebra", true],
  // English: plain questions and words that hold a marker inside
  ["What is the derivative of x squared?", false],
  ["Explain how photosynthesis works step by step", false],
  ["Who discovered the law of gravity?", false],
  ["Summarize the causes of the French Revolution", false],
  ["Translate this sentence into German please", false],
  ["Memory management in operating systems", false],
  ["Mimic the mixing of chemicals in water", false],
  // German: first-person words
  ["Ich bin in der zwölften Klasse", true],
  ["Meine Prüfung ist am zwanzigsten Oktober", true],
  ["Mein Ziel ist das Abitur mit Mathe", true],
  ["Kannst du mir die Ableitung erklären", true],
  ["Das Thema macht mich völlig fertig", true],
  ["Ich lerne am liebsten mit Beispielen", true],
  ["Bei meinen Hausaufgaben fehlt mir Zeit", true],
  // German: plain questions
  ["Was ist die Ableitung von Sinus?", false],
  ["Erkläre bitte den Satz des Pythagoras", false],
  ["Wann begann der Zweite Weltkrieg in Europa?", false],
  ["Wie funktioniert die Photosynthese bei Pflanzen?", false],
  // Too short, with a marker or not
  ["Aku kelas 12", true],
  ["Aku kelas 1", false],
  ["I am in 12", false],
  ["Ich bin Max", false],
  ["Aku suka", false],
  ["            ", false],
  ["   Aku   ", false],
  ["", false],
] as const;

describe("memory capture gate", () => {
  it("labels enough messages in the three languages", () => {
    expect(messages.length).toBeGreaterThanOrEqual(40);
  });

  it("lets a message through only when it is long enough and speaks about the learner", () => {
    const wrong = Arr.filter(
      messages,
      ([message, expected]) => passesGate(message) !== expected
    );
    expect(wrong).toEqual([]);
  });
});
