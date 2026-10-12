import { outside, type Row } from "@repo/backend/test/judgment/label";
import type { Array as Arr } from "effect";

/**
 * Sentences that describe the learner from the outside, by a word that names
 * them or a third person, or that are not in the language of their quote, with
 * nothing private: `ownNote` should drop them.
 */
export const outsideNotes: Arr.NonEmptyReadonlyArray<Row> = [
  outside(
    "id",
    "Latn",
    "label",
    "Learner berada di kelas 12 IPA.",
    "Aku kelas 12 IPA"
  ),
  outside(
    "id",
    "Latn",
    "label",
    "Siswa lebih suka contoh soal dulu sebelum rumus.",
    "Aku lebih mudah paham kalau dikasih contoh soal dulu sebelum rumus"
  ),
  outside(
    "id",
    "Latn",
    "label",
    "Pengguna menargetkan SNBT 2027.",
    "Targetku lolos SNBT 2027"
  ),
  outside(
    "id",
    "Latn",
    "pronoun",
    "Dia lebih suka belajar malam hari.",
    "Aku belajar paling fokus malam hari"
  ),
  outside(
    "en",
    "Latn",
    "label",
    "The learner is in grade 11.",
    "I'm in grade 11"
  ),
  outside(
    "en",
    "Latn",
    "label",
    "Student prefers worked examples before formulas.",
    "I understand better when I see a worked example first"
  ),
  outside(
    "en",
    "Latn",
    "label",
    "User is preparing for the SAT in March.",
    "I'm preparing for the SAT in March"
  ),
  outside(
    "en",
    "Latn",
    "pronoun",
    "She finds word problems really hard.",
    "I find word problems really hard"
  ),
  outside(
    "de",
    "Latn",
    "label",
    "Der Lernende ist in Klasse 12.",
    "Ich bin in der 12. Klasse"
  ),
  outside(
    "de",
    "Latn",
    "label",
    "Schüler lernt lieber erst mit Beispielaufgaben.",
    "Ich lerne lieber erst mit Beispielaufgaben"
  ),
  outside(
    "jv",
    "Latn",
    "label",
    "Siswa kelas 11 seneng sinau nganggo gambar.",
    "Aku kelas 11 lan seneng sinau nganggo gambar"
  ),
  outside(
    "su",
    "Latn",
    "label",
    "Murid kelas 12 hoyong lebet ka Universitas Padjadjaran.",
    "Abdi kelas 12 sareng hoyong lebet ka Universitas Padjadjaran"
  ),
  outside(
    "ar",
    "Arab",
    "label",
    "الطالب في الصف الحادي عشر.",
    "أنا في الصف الحادي عشر"
  ),
  outside(
    "ja",
    "Jpan",
    "label",
    "学習者は高校三年生です。",
    "高校三年生で、来年は東京大学を目指しています"
  ),
  outside(
    "ja",
    "Jpan",
    "label",
    "生徒は確率が苦手です。",
    "確率がとても苦手です"
  ),
  outside(
    "zh",
    "Hans",
    "label",
    "该用户是高二学生。",
    "我是高二学生，想考北京大学计算机系"
  ),
  outside("hi", "Deva", "label", "छात्र कक्षा 11 में है।", "मैं कक्षा 11 में हूँ"),
  outside(
    "es",
    "Latn",
    "label",
    "El estudiante está en tercero de bachillerato.",
    "Estoy en tercero de bachillerato"
  ),
  outside(
    "es",
    "Latn",
    "pronoun",
    "Ella aprende mejor paso a paso.",
    "Aprendo mejor paso a paso"
  ),
  outside(
    "ko",
    "Hang",
    "label",
    "학습자는 고등학교 3학년이다.",
    "저는 고등학교 3학년이고"
  ),
  outside("th", "Thai", "label", "ผู้เรียนอยู่ชั้นมัธยมปีที่ 6", "ฉันเรียนอยู่ชั้นมัธยมปีที่ 6"),
  outside(
    "ru",
    "Cyrl",
    "label",
    "Ученик учится в 11 классе.",
    "Я учусь в 11 классе"
  ),
  outside(
    "fr",
    "Latn",
    "label",
    "L'élève est en terminale.",
    "Je suis en terminale"
  ),
  outside(
    "tr",
    "Latn",
    "label",
    "Öğrenci on birinci sınıfa gidiyor.",
    "On birinci sınıfa gidiyorum"
  ),
  outside(
    "vi",
    "Latn",
    "label",
    "Học sinh đang học lớp 12.",
    "Em đang học lớp 12"
  ),
  outside(
    "pt",
    "Latn",
    "label",
    "O aluno está no terceiro ano do ensino médio.",
    "Estou no terceiro ano do ensino médio"
  ),
  outside(
    "id",
    "Latn",
    "language",
    "Grade 12, science track.",
    "Aku kelas 12 IPA"
  ),
  outside(
    "ja",
    "Jpan",
    "language",
    "Third year of high school.",
    "高校三年生で、来年は東京大学を目指しています"
  ),
];
