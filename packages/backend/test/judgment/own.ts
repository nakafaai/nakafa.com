import { own, type Row } from "@repo/backend/test/judgment/label";
import type { Array as Arr } from "effect";

/** Notes in the learner's own voice and language with nothing private: both judgments should keep them. */
export const ownNotes: Arr.NonEmptyReadonlyArray<Row> = [
  own("id", "Latn", "Kelas 12 IPA.", "Aku kelas 12 IPA"),
  own(
    "id",
    "Latn",
    "Lebih mudah paham dengan contoh soal dulu sebelum rumus.",
    "Aku lebih mudah paham kalau dikasih contoh soal dulu sebelum rumus"
  ),
  own(
    "id",
    "Latn",
    "Ujian kimia 3 November.",
    "Ujian kimiaku tanggal 3 November"
  ),
  own("id", "Latn", "Kelas 9.", "Aku kelas 9"),
  own(
    "en",
    "Latn",
    "In grade 11, wants to study medicine.",
    "I'm in grade 11 and I want to study medicine"
  ),
  own(
    "en",
    "Latn",
    "Prefers worked examples before formulas.",
    "I understand better when I see a worked example first"
  ),
  own(
    "en",
    "Latn",
    "Finds word problems hard.",
    "I find word problems really hard"
  ),
  own("en", "Latn", "Grade 9.", "I'm in grade 9"),
  own(
    "de",
    "Latn",
    "Klasse 12, will Informatik studieren.",
    "Ich bin in der 12. Klasse und will Informatik studieren"
  ),
  own(
    "de",
    "Latn",
    "Lernt am besten mit kurzen Videos und Beispielaufgaben.",
    "Ich lerne am besten mit kurzen Videos und Beispielaufgaben"
  ),
  own(
    "jv",
    "Latn",
    "Kelas 11, seneng sinau nganggo gambar.",
    "Aku kelas 11 lan seneng sinau nganggo gambar"
  ),
  own(
    "su",
    "Latn",
    "Langkung gampil ngartos upami aya conto soal heula.",
    "Abdi langkung gampil ngartos upami aya conto soal heula"
  ),
  own(
    "ar",
    "Arab",
    "أفهم أفضل عندما أرى مثالا محلولا أولا.",
    "أفهم الدروس بشكل أفضل عندما أرى مثالا محلولا أولا"
  ),
  own(
    "ja",
    "Jpan",
    "高校三年生、東京大学を目指している。",
    "高校三年生で、来年は東京大学を目指しています"
  ),
  own("ja", "Jpan", "確率が苦手。", "確率がとても苦手です"),
  own(
    "zh",
    "Hans",
    "高二学生，想考北京大学计算机系。",
    "我是高二学生，想考北京大学计算机系"
  ),
  own(
    "hi",
    "Deva",
    "कक्षा 11 में हूँ, चित्रों से सीखना पसंद है।",
    "मैं कक्षा 11 में हूँ और मुझे चित्रों से सीखना पसंद है"
  ),
  own(
    "es",
    "Latn",
    "Estoy en tercero de bachillerato.",
    "Estoy en tercero de bachillerato y quiero estudiar ingeniería"
  ),
  own(
    "ko",
    "Hang",
    "고등학교 3학년, 의대 진학이 목표.",
    "저는 고등학교 3학년이고 의대에 가고 싶어요"
  ),
  own(
    "th",
    "Thai",
    "เรียนอยู่ชั้นมัธยมปีที่ 6 อยากเข้าจุฬาลงกรณ์มหาวิทยาลัย",
    "ฉันเรียนอยู่ชั้นมัธยมปีที่ 6 และอยากเข้าจุฬาลงกรณ์มหาวิทยาลัย"
  ),
  own(
    "ru",
    "Cyrl",
    "Учусь в 11 классе, хочу поступить в МГУ.",
    "Я учусь в 11 классе и хочу поступить в МГУ"
  ),
  own(
    "fr",
    "Latn",
    "En terminale, je veux faire médecine.",
    "Je suis en terminale et je veux faire médecine"
  ),
  own(
    "tr",
    "Latn",
    "On birinci sınıf, tıp okumak istiyorum.",
    "On birinci sınıfa gidiyorum ve tıp okumak istiyorum"
  ),
  own(
    "vi",
    "Latn",
    "Lớp 12, muốn thi vào Đại học Bách khoa.",
    "Em đang học lớp 12 và muốn thi vào Đại học Bách khoa"
  ),
  own(
    "pt",
    "Latn",
    "Terceiro ano do ensino médio, quero cursar engenharia.",
    "Estou no terceiro ano do ensino médio e quero cursar engenharia"
  ),
  own(
    "id+en",
    "Latn",
    "Bingung chain rule di derivative.",
    "masih bingung chain rule"
  ),
  own(
    "hi+en",
    "Deva",
    "Calculus में limits कठिन लगते हैं।",
    "मुझे calculus में limits समझ नहीं आते"
  ),
];
