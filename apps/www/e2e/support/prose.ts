import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Array as Arr } from "effect";
import type { ServedMessage, StoredMessage } from "@/e2e/support/query";

/** The moment every stored message was written, in milliseconds. */
const WRITTEN = 1_760_000_000_000;

/** The facts of a finished turn, which each message of the turn carries. */
const finishedTurn = (order: number): typeof NinaTurnSummary.Type => ({
  order,
  promptMessageId: `prose-prompt-${order}`,
  state: { finishedAt: WRITTEN + order, status: "complete" },
  usage: [],
});

/** A file a learner attached, as the message stores it. */
const attached = (filename: string, mediaType: string, url: string) => ({
  filename,
  mediaType,
  type: "file",
  url,
});

/** What a learner wrote in turn `order`, and the files they attached. */
export const learnerMessage = ({
  files = [],
  order,
  text,
}: {
  files?: readonly ReturnType<typeof attached>[];
  order: number;
  text: string;
}): StoredMessage => ({
  _creationTime: WRITTEN + order,
  id: `prose-learner-${order}`,
  key: `prose-${order}-0`,
  order,
  parts: [{ text, type: "text" }, ...files],
  role: "user",
  status: "success",
  stepOrder: 0,
  text,
});

/**
 * What Nina answered in turn `order`: an answer in Markdown, the thought that
 * came before it, and the follow-up questions she suggests.
 */
export const answerMessage = ({
  markdown,
  order,
  reasoning,
  suggestions,
}: {
  markdown: string;
  order: number;
  reasoning?: string;
  suggestions?: readonly string[];
}): ServedMessage => ({
  _creationTime: WRITTEN + order,
  id: `prose-answer-${order}`,
  key: `prose-${order}-1`,
  metadata: {
    ...finishedTurn(order),
    ...(suggestions ? { suggestions: Arr.fromIterable(suggestions) } : {}),
  },
  order,
  parts: [
    ...(reasoning === undefined
      ? []
      : [{ state: "done", text: reasoning, type: "reasoning" }]),
    { state: "done", text: markdown, type: "text" },
  ],
  role: "assistant",
  status: "success",
  stepOrder: 1,
  text: markdown,
});

/** A question and Nina's answer to it, in the turn the answer names. */
export const answerTurn = (answer: Parameters<typeof answerMessage>[0]) => ({
  answer: answerMessage(answer),
  question: learnerMessage({
    order: answer.order,
    text: `Pertanyaan ${answer.order}`,
  }),
});

/** The messages of a chat of turns, each question before its answer. */
export const chatOf = (turns: readonly ReturnType<typeof answerTurn>[]) =>
  Arr.flatMap(turns, ({ answer, question }) => [question, answer]);

/** A small picture, drawn as an SVG that the page reads from its own address. */
const picture = (number: number) =>
  attached(
    `foto-${number}.svg`,
    "image/svg+xml",
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#dbeafe"/><text x="240" y="190" font-size="140" text-anchor="middle" fill="#1e3a8a">${number}</text></svg>`
    )}`
  );

/** The pictures one message attaches. */
export const pictures = (count: number) =>
  Arr.makeBy(count, (index) => picture(index + 1));

/** A document of the longest realistic name, and one of a short name. */
export const WORKSHEET_NAME =
  "Lembar kerja limit fungsi trigonometri (revisi) v12 FINAL.pdf";
const PDF = "data:application/pdf;base64,JVBERi0xLjQK";
export const worksheet = attached(WORKSHEET_NAME, "application/pdf", PDF);
export const NOTE_NAME = "Soal.pdf";
export const note = attached(NOTE_NAME, "application/pdf", PDF);

/** A pasted set of ninety exercises, one per line, of more than ten thousand characters. */
export const PASTED = Arr.join(
  Arr.makeBy(
    90,
    (index) =>
      `Soal ${index + 1}. Tentukan nilai limit dari fungsi f(x) = sin(${index + 1}x) / x ketika x mendekati nol, lalu jelaskan langkahnya.`
  ),
  "\n"
);

/** A link of 220 characters, as a learner copies it from a browser. */
const LONG_LINK =
  "https://example.com/pembahasan/matematika/kelas-11/limit-fungsi-trigonometri/soal-latihan-dan-pembahasan-lengkap-dengan-langkah-langkah-penyelesaian?sumber=bagikan&tab=latihan&nomor=12&bahasa=id&halaman=3&utm=bagikan&x=1";

/** A formula that fits in the column and sits in a line of text. */
export const FITTING_TEX = "x^2 + 1";
/**
 * A formula that KaTeX can break after `=`, `+` and `-`: its pieces fit in the
 * column of a phone one by one, and side by side they are wider than it.
 */
export const BREAKABLE_TEX = String.raw`P(A \cup B) = P(A) + P(B) - P(A \cap B)`;
/** A formula that KaTeX cannot break, and that is wider than a phone's column. */
export const UNBREAKABLE_TEX = String.raw`\left( x_1 + x_2 + x_3 + x_4 + x_5 + x_6 + x_7 + x_8 + x_9 + x_{10} + x_{11} + x_{12} \right)^2`;
/** A display formula that is wider than the column. */
const DISPLAY_FORMULA = String.raw`\[ f(x) = a_0 + a_1 x + a_2 x^2 + a_3 x^3 + a_4 x^4 + a_5 x^5 + a_6 x^6 + a_7 x^7 + a_8 x^8 + a_9 x^9 \]`;

/** The delimiters a model writes around an inline formula. */
const inline = (tex: string) => String.raw`\(${tex}\)`;

/** A line of code of 300 characters. */
const LONG_CODE_LINE = `const className = "${Arr.join(
  Arr.makeBy(15, () => "flex items-center"),
  " "
)} px-2 py-4";`;

/** The title and the description that the diagram of `ANSWER.diagram` gives itself. */
export const DIAGRAM_TITLE = "Alur pendaftaran siswa baru";
export const DIAGRAM_DESCRIPTION = "Dari pengisian formulir sampai arsip";

/** Nina's answers, in Markdown, as each place of a page reads them. */
export const ANSWER = {
  arabic:
    "هناك ثلاث خطوات لحساب المشتقة.\n\n1. حدد الدالة المطلوبة.\n2. طبق قاعدة القوة.\n3. بسّط النتيجة.",
  arabicBlocks:
    "## الاشتقاق\n\nالجدول يلخص القاعدة.\n\n| الدالة | المشتقة |\n| --- | --- |\n| قوة | نقص الأس |",
  arabicLoose:
    "الخطوات:\n\n1. حدد الدالة المطلوبة.\n\n2. طبق قاعدة القوة.\n\n3. بسّط النتيجة.",
  code: `Berikut contoh komponennya.\n\n\`\`\`javascriptreactjsx\n${LONG_CODE_LINE}\nexport const Kartu = () => <div className={className}>Halo</div>;\n\`\`\``,
  diagram: `Alurnya seperti ini.\n\n\`\`\`mermaid title="${DIAGRAM_TITLE}" description="${DIAGRAM_DESCRIPTION}"\nflowchart TD\n  A[Mulai] --> B[Isi formulir pendaftaran]\n  B --> C{Data lengkap?}\n  C -- Tidak --> B\n  C -- Ya --> D[Unggah dokumen]\n  D --> E[Bayar biaya pendaftaran]\n  E --> F{Pembayaran valid?}\n  F -- Tidak --> E\n  F -- Ya --> G[Verifikasi panitia]\n  G --> H[Tes seleksi]\n  H --> I[Pengumuman hasil]\n  I --> J[Daftar ulang]\n  J --> K[Selesai]\n  K --> L[Arsip]\n\`\`\``,
  diagramPlain:
    "Alurnya seperti ini.\n\n```mermaid\nflowchart TD\n  A[Mulai] --> B[Selesai]\n```",
  diagramBroken: `Alurnya seperti ini.\n\n\`\`\`mermaid title="Diagram yang salah"\nflowchart TD\n  A[Mulai] -->\n  --> B[Selesai\n\`\`\``,
  formulas: `Rumus peluang gabungan adalah ${inline(BREAKABLE_TEX)}, dan nilai ${inline(FITTING_TEX)} tetap satu baris.\n\nKuadrat jumlahnya adalah ${inline(UNBREAKABLE_TEX)} untuk dua belas suku.\n\n${DISPLAY_FORMULA}`,
  link: `Pembahasan lengkapnya ada di ${LONG_LINK} untuk dibaca.`,
  mixedList:
    "1. Turunan pertama\n2. الاشتقاق هو معدل التغير.\n3. Turunan kedua",
  nested:
    "- Tingkat satu\n  - Tingkat dua\n    - Tingkat tiga\n      - Tingkat empat dengan teks yang cukup panjang supaya baris dibungkus di kolom yang sempit",
  table:
    "| Fungsi | Turunan pertama | Turunan kedua | Titik stasioner | Jenis titik | Keterangan lengkap |\n| --- | --- | --- | --- | --- | --- |\n| x^2 | 2x | 2 | x = 0 | minimum | Fungsi kuadrat terbuka ke atas |\n| sin x | cos x | -sin x | x = pi/2 + k pi | maksimum atau minimum | Fungsi periodik dengan periode 2 pi |",
};

/** Three follow-up questions in German, of the length a model writes. */
export const GERMAN_SUGGESTIONS = [
  "Kannst du mir bitte Schritt für Schritt erklären, wie man die Ableitung der Sinusfunktion mithilfe des Grenzwerts des Differenzenquotienten herleitet?",
  "Warum ist der Grenzwert von sin(h) geteilt durch h für h gegen null gleich eins, und wie hängt das mit dem Einheitskreis zusammen?",
  "Welche typischen Fehler machen Schülerinnen und Schüler bei der Kettenregel, wenn sie trigonometrische Funktionen ableiten?",
];

/** What learners wrote that Markdown would read as markup, as a message of each. */
export const LEARNER_TEXT = {
  angle: "Beda List<String> dan ArrayList<String>?",
  ampersand: "R&D",
  arabic: "ما هو الاشتقاق؟",
  /** An Arabic sentence that ends in a full stop, which has no direction of its own. */
  arabicSentence: "الاشتقاق هو معدل التغير.",
  choices: "A. 2\nB. 3\nC. 4",
  corners: "【問題】微分とは何ですか？",
  indented: "Soal:\n\n    A. 2\n    B. 3",
  link: LONG_LINK,
  one: "Turunan",
  product: "2*3 + 4*5",
  relation: "Jika x<y dan y>z",
};
