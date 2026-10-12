import { type Array as Arr, Schema } from "effect";

/**
 * One whole message of a learner, with the answer `lasting` should give
 * (`judgment/catalog`), the only judgment asked about a whole message.
 * `languages` holds the ISO 639 code of its language, or two codes joined by
 * `+` when the message mixes two. `script` is the ISO 15924 code of its script,
 * and `Zyyy` when it has none. `form` names the kind of private data a message
 * holds, to describe it in a report without quoting it.
 *
 * Every message is invented for this set. None holds a real person's data:
 * numbers, addresses and names are made up.
 */
const Message = Schema.Struct({
  form: Schema.optionalKey(Schema.NonEmptyString),
  languages: Schema.NonEmptyString,
  lasting: Schema.Boolean,
  script: Schema.NonEmptyString,
  text: Schema.NonEmptyString,
});

type Row = typeof Message.Type;

/** A message that states something lasting about the learner and holds nothing private. */
function lasting(languages: string, script: string, text: string): Row {
  return { languages, lasting: true, script, text };
}

/** A message that states nothing lasting, such as a question, a request or thanks, and holds nothing private. */
function passing(languages: string, script: string, text: string): Row {
  return { languages, lasting: false, script, text };
}

/** A message that holds private data of one form and states nothing lasting. */
function secret(
  languages: string,
  script: string,
  form: string,
  text: string
): Row {
  return { form, languages, lasting: false, script, text };
}

/** A message that states something lasting and holds private data of one form. */
function both(
  languages: string,
  script: string,
  form: string,
  text: string
): Row {
  return { form, languages, lasting: true, script, text };
}

/**
 * The messages `lasting` is measured against (`judgment:measure`): 124 whole
 * messages in 17 languages and 8 scripts, asked one at a time as the capture
 * asks. The number of a message is its position in this list, counted from 1,
 * and it is the only thing the command prints about a message.
 */
export const messages: Arr.NonEmptyReadonlyArray<Row> = [
  // Something lasting: a grade or level, a goal, how they like to learn, something hard, a dated situation.
  lasting(
    "id",
    "Latn",
    "Aku kelas 12 IPA dan mau masuk ITB jurusan informatika tahun depan."
  ),
  lasting(
    "id",
    "Latn",
    "Aku lebih mudah paham kalau dikasih contoh soal dulu sebelum rumus."
  ),
  lasting(
    "id",
    "Latn",
    "Ujian kimiaku tanggal 3 November, dan bab yang paling susah buatku itu stoikiometri."
  ),
  lasting("id", "Latn", "Aku kelas 10 dan masih bingung sama logaritma."),
  lasting("id", "Latn", "Targetku lolos SNBT 2027 di Universitas Indonesia."),
  lasting(
    "id",
    "Latn",
    "Aku belajar paling fokus malam hari dan suka pakai gambar atau diagram."
  ),
  lasting("id", "Latn", "Aku kelas 9."),
  lasting("en", "Latn", "I'm in grade 11 and I want to study medicine."),
  lasting(
    "en",
    "Latn",
    "I understand better when I see a worked example first."
  ),
  lasting(
    "en",
    "Latn",
    "My physics exam is on 14 November and I struggle with circuits."
  ),
  lasting("en", "Latn", "I'm preparing for the SAT in March."),
  lasting("en", "Latn", "I find word problems really hard."),
  lasting(
    "de",
    "Latn",
    "Ich bin in der 12. Klasse und will Informatik studieren."
  ),
  lasting(
    "de",
    "Latn",
    "Meine Mathe-Klausur ist am 3. November, Integrale sind für mich schwer."
  ),
  lasting(
    "de",
    "Latn",
    "Ich lerne am besten mit kurzen Videos und Beispielaufgaben."
  ),
  lasting("de", "Latn", "Ich bereite mich auf das Abitur 2027 vor."),
  lasting("jv", "Latn", "Aku kelas 11 lan seneng sinau nganggo gambar."),
  lasting(
    "jv",
    "Latn",
    "Ujianku tanggal 20 Oktober, matematika sing paling angel tumrap aku."
  ),
  lasting(
    "jv",
    "Latn",
    "Aku pengin mlebu Universitas Gadjah Mada taun ngarep."
  ),
  lasting(
    "su",
    "Latn",
    "Abdi kelas 12 sareng hoyong lebet ka Universitas Padjadjaran."
  ),
  lasting(
    "su",
    "Latn",
    "Abdi langkung gampil ngartos upami aya conto soal heula."
  ),
  lasting(
    "su",
    "Latn",
    "Ujian fisika abdi tanggal 5 Nopémber, listrik téh hésé pisan pikeun abdi."
  ),
  lasting("ar", "Arab", "أنا في الصف الحادي عشر وأريد أن أدرس الطب."),
  lasting("ar", "Arab", "أفهم الدروس بشكل أفضل عندما أرى مثالا محلولا أولا."),
  lasting(
    "ar",
    "Arab",
    "امتحاني في الفيزياء يوم ١٤ نوفمبر والدوائر الكهربائية صعبة علي."
  ),
  lasting("ja", "Jpan", "高校三年生で、来年は東京大学を目指しています。"),
  lasting("ja", "Jpan", "例題を先に見ると理解しやすいです。"),
  lasting("ja", "Jpan", "確率がとても苦手です。"),
  lasting("zh", "Hans", "我是高二学生，想考北京大学计算机系。"),
  lasting("zh", "Hans", "看到例题以后我才更容易理解。"),
  lasting("zh", "Hans", "我的物理考试在十一月十四日，电路对我来说很难。"),
  lasting("hi", "Deva", "मैं कक्षा 11 में हूँ और मुझे चित्रों से सीखना पसंद है।"),
  lasting(
    "hi",
    "Deva",
    "मेरी गणित की परीक्षा 3 नवंबर को है और समाकलन मुझे कठिन लगता है।"
  ),
  lasting(
    "es",
    "Latn",
    "Estoy en tercero de bachillerato y quiero estudiar ingeniería."
  ),
  lasting(
    "es",
    "Latn",
    "Aprendo mejor paso a paso, me pierdo con las fórmulas largas."
  ),
  lasting("ko", "Hang", "저는 고등학교 3학년이고 의대에 가고 싶어요."),
  lasting("ko", "Hang", "확률이 너무 어려워요."),
  lasting("th", "Thai", "ฉันเรียนอยู่ชั้นมัธยมปีที่ 6 และอยากเข้าจุฬาลงกรณ์มหาวิทยาลัย"),
  lasting("th", "Thai", "ฉันเข้าใจง่ายขึ้นเมื่อได้เห็นตัวอย่างโจทย์ก่อน"),
  lasting("ru", "Cyrl", "Я учусь в 11 классе и хочу поступить в МГУ."),
  lasting(
    "ru",
    "Cyrl",
    "Экзамен по физике у меня 14 ноября, электрические цепи мне очень трудны."
  ),
  lasting("fr", "Latn", "Je suis en terminale et je veux faire médecine."),
  lasting("tr", "Latn", "On birinci sınıfa gidiyorum ve tıp okumak istiyorum."),
  lasting(
    "vi",
    "Latn",
    "Em đang học lớp 12 và muốn thi vào Đại học Bách khoa."
  ),
  lasting(
    "pt",
    "Latn",
    "Estou no terceiro ano do ensino médio e quero cursar engenharia."
  ),
  lasting(
    "id+en",
    "Latn",
    "Aku lagi belajar derivative tapi masih bingung chain rule."
  ),
  lasting(
    "id+en",
    "Latn",
    "Besok ada ulangan physics jam 7 pagi, aku grade 11."
  ),
  lasting(
    "de+en",
    "Latn",
    "Mein Ziel ist ein Studium in Computer Science, ich bin in der 11. Klasse."
  ),
  lasting("ja+en", "Jpan", "来年SATを受けるので、数学を勉強しています。"),
  lasting(
    "hi+en",
    "Deva",
    "मुझे calculus में limits समझ नहीं आते, यह मेरे लिए hard है।"
  ),

  // Nothing lasting: questions, requests, thanks, a message about another person, a long number in a sum, a public link.
  passing("id", "Latn", "Apa turunan dari x^3 sin x?"),
  passing("id", "Latn", "Tolong jelaskan lagi, aku masih bingung."),
  passing("id", "Latn", "Makasih ya!"),
  passing("id", "Latn", "Jelaskan proses fotosintesis secara singkat."),
  passing("id", "Latn", "Hitung 123456789 x 987654321."),
  passing("id", "Latn", "Buatkan 5 soal latihan tentang integral tentu."),
  passing(
    "id",
    "Latn",
    "Lihat materi ini: https://nakafa.com/id/subject/high-school/11/mathematics/limits"
  ),
  passing("id", "Latn", "Kakakku kelas 9 dan dia suka matematika."),
  passing("en", "Latn", "Explain photosynthesis step by step."),
  passing("en", "Latn", "What is the derivative of e^x?"),
  passing("en", "Latn", "thanks"),
  passing("en", "Latn", "Can you check my answer to question 5?"),
  passing("en", "Latn", "I don't get this step."),
  passing("en", "Latn", "What's the capital of Australia?"),
  passing("de", "Latn", "Was ist die Ableitung von e^x?"),
  passing("de", "Latn", "Kannst du das bitte noch einmal erklären?"),
  passing("de", "Latn", "Danke!"),
  passing("jv", "Latn", "Apa tegese fotosintesis?"),
  passing("jv", "Latn", "Matur nuwun, aku wis paham."),
  passing("su", "Latn", "Naon hartosna turunan fungsi?"),
  passing("su", "Latn", "Hatur nuhun pisan!"),
  passing("ar", "Arab", "ما هو ناتج ٣٤ × ١٢؟"),
  passing("ar", "Arab", "شكرا جزيلا"),
  passing("ja", "Jpan", "二次方程式の解き方を教えてください。"),
  passing("ja", "Jpan", "ありがとうございました。"),
  passing("zh", "Hans", "请解释一下光合作用的过程。"),
  passing("zh", "Hans", "这道题的第二步我没看懂。"),
  passing("hi", "Deva", "समाकलन क्या होता है?"),
  passing("es", "Latn", "¿Cómo se resuelve una ecuación cuadrática?"),
  passing("ko", "Hang", "미분이 뭐예요?"),
  passing("th", "Thai", "ช่วยอธิบายเรื่องแรงโน้มถ่วงหน่อย"),
  passing("ru", "Cyrl", "Объясни, пожалуйста, теорему Пифагора."),
  passing("fr", "Latn", "Peux-tu m'expliquer la photosynthèse ?"),
  passing("tr", "Latn", "Türev nedir?"),
  passing("vi", "Latn", "Giải thích giúp em định luật Newton nhé."),
  passing("pt", "Latn", "Pode explicar a fotossíntese?"),
  passing("id", "Latn", "halo"),
  passing("en", "Latn", "ok"),
  passing("en", "Latn", "?"),
  passing("und", "Zyyy", "👍"),
  passing("id+en", "Latn", "Tolong explain the chain rule, thanks!"),
  passing("ja+en", "Jpan", "この derivative の意味を教えてください。"),
  passing(
    "de+en",
    "Latn",
    "Wie berechne ich the limit of sin(x)/x für x gegen 0?"
  ),

  // Private data of one form each, and nothing lasting about the learner.
  secret(
    "id",
    "Latn",
    "phone",
    "Nomor HP-ku 0812 3456 7890, hubungi aku kalau ada kabar."
  ),
  secret(
    "en",
    "Latn",
    "phone",
    "Call me on +62 812 3456 7890 if you find out."
  ),
  secret("ja", "Jpan", "phone", "電話番号は090-1234-5678です。"),
  secret("hi", "Deva", "phone", "मेरा फोन नंबर 98765 43210 है।"),
  secret(
    "id",
    "Latn",
    "email",
    "Emailku nama.lengkap@example.com, kirim materinya ke sana ya."
  ),
  secret(
    "de",
    "Latn",
    "email",
    "Meine E-Mail-Adresse ist max.mustermann@example.org."
  ),
  secret(
    "id",
    "Latn",
    "address",
    "Alamatku Jl. Mawar Indah No. 12 RT 03 RW 05, Kelurahan Cihapit, Bandung."
  ),
  secret("en", "Latn", "address", "I live at 221B Baker Street, London."),
  secret(
    "de",
    "Latn",
    "address",
    "Ich wohne in der Hauptstraße 5, 10115 Berlin."
  ),
  secret("zh", "Hans", "address", "我住在北京市海淀区中关村大街一号。"),
  secret(
    "id",
    "Latn",
    "account",
    "Nomor rekeningku BCA 1234567890 atas nama Budi Santoso."
  ),
  secret(
    "es",
    "Latn",
    "account",
    "Mi cuenta bancaria es ES91 2100 0418 4502 0005 1332."
  ),
  secret("id", "Latn", "identity", "NIK-ku 3273012345670001."),
  secret(
    "en",
    "Latn",
    "password",
    "My password for the school portal is Maple2026!"
  ),
  secret("id", "Latn", "illness", "Dokter bilang aku menderita asma kronis."),
  secret("de", "Latn", "illness", "Ich habe Diabetes Typ 1."),
  secret(
    "id",
    "Latn",
    "religion",
    "Aku beragama Kristen dan ikut sekolah minggu setiap Minggu pagi."
  ),
  secret("ar", "Arab", "religion", "أنا مسلم وأصوم كل اثنين وخميس."),
  secret(
    "en",
    "Latn",
    "religion",
    "I'm Hindu and our family celebrates Diwali together."
  ),
  secret("id", "Latn", "ethnicity", "Aku keturunan Tionghoa dari Medan."),
  secret(
    "en",
    "Latn",
    "politics",
    "I voted for the green party in the last election."
  ),
  secret("id", "Latn", "salary", "Gaji ayahku 4 juta rupiah per bulan."),
  secret("en", "Latn", "salary", "My mom earns $3,200 a month as a nurse."),
  secret(
    "de",
    "Latn",
    "debt",
    "Meine Eltern haben 20.000 Euro Schulden bei der Bank."
  ),
  secret("ko", "Hang", "identity", "제 주민등록번호는 050505-3123456입니다."),

  // Something lasting that also holds private data: a lasting message the capture reads, and a candidate that `private` then drops.
  both(
    "de",
    "Latn",
    "illness",
    "Ich habe ADHS und lerne am besten in kurzen Abschnitten."
  ),
  both(
    "id",
    "Latn",
    "illness",
    "Aku punya diabetes dan sering izin sekolah, jadi butuh rencana belajar yang fleksibel."
  ),
  both(
    "id",
    "Latn",
    "salary",
    "Gaji ayahku 4 juta sebulan, jadi aku harus dapat beasiswa untuk kuliah di ITB."
  ),
  both(
    "en",
    "Latn",
    "illness",
    "I have dyslexia, so I prefer audio explanations and short sentences."
  ),
  both(
    "id",
    "Latn",
    "religion",
    "Karena aku Muslim, aku puasa Senin Kamis dan belajar paling baik setelah sahur."
  ),
  both("zh", "Hans", "illness", "我有焦虑症，所以考试前需要更多时间复习。"),
];
