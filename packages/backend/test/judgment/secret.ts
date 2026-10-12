import { exposed, type Row, secret } from "@repo/backend/test/judgment/label";
import type { Array as Arr } from "effect";

/**
 * Sentences that hold private data of one form each: `private` should drop
 * them. Most are in the learner's own voice, and the last three also describe
 * the learner from the outside, so both judgments should drop those.
 */
export const secretNotes: Arr.NonEmptyReadonlyArray<Row> = [
  secret(
    "id",
    "Latn",
    "phone",
    "Nomor HP 0812 3456 7890.",
    "Nomor HP-ku 0812 3456 7890"
  ),
  secret(
    "en",
    "Latn",
    "phone",
    "Phone number +62 812 3456 7890.",
    "Call me on +62 812 3456 7890"
  ),
  secret(
    "ja",
    "Jpan",
    "phone",
    "電話番号は090-1234-5678。",
    "電話番号は090-1234-5678です"
  ),
  secret(
    "hi",
    "Deva",
    "phone",
    "फोन नंबर 98765 43210।",
    "मेरा फोन नंबर 98765 43210 है"
  ),
  secret(
    "id",
    "Latn",
    "email",
    "Email nama.lengkap@example.com.",
    "Emailku nama.lengkap@example.com"
  ),
  secret(
    "de",
    "Latn",
    "email",
    "E-Mail-Adresse max.mustermann@example.org.",
    "Meine E-Mail-Adresse ist max.mustermann@example.org"
  ),
  secret(
    "id",
    "Latn",
    "address",
    "Alamat Jl. Mawar Indah No. 12 RT 03 RW 05, Bandung.",
    "Alamatku Jl. Mawar Indah No. 12 RT 03 RW 05"
  ),
  secret(
    "en",
    "Latn",
    "address",
    "Lives at 221B Baker Street, London.",
    "I live at 221B Baker Street, London"
  ),
  secret(
    "de",
    "Latn",
    "address",
    "Wohnt in der Hauptstraße 5, 10115 Berlin.",
    "Ich wohne in der Hauptstraße 5, 10115 Berlin"
  ),
  secret(
    "zh",
    "Hans",
    "address",
    "住在北京市海淀区中关村大街一号。",
    "我住在北京市海淀区中关村大街一号"
  ),
  secret(
    "id",
    "Latn",
    "account",
    "Rekening BCA 1234567890 atas nama Budi Santoso.",
    "Nomor rekeningku BCA 1234567890 atas nama Budi Santoso"
  ),
  secret(
    "es",
    "Latn",
    "account",
    "Cuenta bancaria ES91 2100 0418 4502 0005 1332.",
    "Mi cuenta bancaria es ES91 2100 0418 4502 0005 1332"
  ),
  secret(
    "id",
    "Latn",
    "identity",
    "NIK 3273012345670001.",
    "NIK-ku 3273012345670001"
  ),
  secret(
    "ko",
    "Hang",
    "identity",
    "주민등록번호 050505-3123456.",
    "제 주민등록번호는 050505-3123456입니다"
  ),
  secret(
    "en",
    "Latn",
    "password",
    "Password of the school portal is Maple2026!",
    "My password for the school portal is Maple2026!"
  ),
  secret(
    "id",
    "Latn",
    "illness",
    "Menderita asma kronis.",
    "aku menderita asma kronis"
  ),
  secret("de", "Latn", "illness", "Diabetes Typ 1.", "Ich habe Diabetes Typ 1"),
  secret(
    "en",
    "Latn",
    "illness",
    "Has dyslexia, prefers audio explanations.",
    "I have dyslexia, so I prefer audio explanations"
  ),
  secret(
    "zh",
    "Hans",
    "illness",
    "患有焦虑症，考试前需要更多复习时间。",
    "我有焦虑症，所以考试前需要更多时间复习"
  ),
  secret(
    "id",
    "Latn",
    "religion",
    "Beragama Kristen, ikut sekolah minggu.",
    "Aku beragama Kristen dan ikut sekolah minggu"
  ),
  secret(
    "ar",
    "Arab",
    "religion",
    "مسلم ويصوم كل اثنين وخميس.",
    "أنا مسلم وأصوم كل اثنين وخميس"
  ),
  secret(
    "en",
    "Latn",
    "religion",
    "Hindu, celebrates Diwali with family.",
    "I'm Hindu and our family celebrates Diwali together"
  ),
  secret(
    "id",
    "Latn",
    "ethnicity",
    "Keturunan Tionghoa dari Medan.",
    "Aku keturunan Tionghoa dari Medan"
  ),
  secret(
    "en",
    "Latn",
    "politics",
    "Voted for the green party.",
    "I voted for the green party in the last election"
  ),
  secret(
    "id",
    "Latn",
    "salary",
    "Gaji ayah 4 juta rupiah per bulan.",
    "Gaji ayahku 4 juta rupiah per bulan"
  ),
  secret(
    "en",
    "Latn",
    "salary",
    "Mom earns $3,200 a month as a nurse.",
    "My mom earns $3,200 a month as a nurse"
  ),
  secret(
    "de",
    "Latn",
    "debt",
    "Eltern haben 20.000 Euro Schulden bei der Bank.",
    "Meine Eltern haben 20.000 Euro Schulden bei der Bank"
  ),
  exposed(
    "id",
    "Latn",
    "illness",
    "Siswa menderita asma kronis.",
    "aku menderita asma kronis"
  ),
  exposed(
    "en",
    "Latn",
    "salary",
    "The student's mother earns $3,200 a month.",
    "My mom earns $3,200 a month as a nurse"
  ),
  exposed(
    "de",
    "Latn",
    "illness",
    "Der Schüler hat Diabetes Typ 1.",
    "Ich habe Diabetes Typ 1"
  ),
];
