import type { PrintableLetter } from "@repo/backend/confect/records/letter";
import { Array as Arr, Effect } from "effect";
import { jsPDF } from "jspdf";
import { encode } from "uqr";

/** The months as an Indonesian date names them. */
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** The A4 page in millimetres, and the margin every line keeps. */
const PAGE = { height: 297, margin: 20, width: 210 };

/** The side of the QR code on the page, in millimetres. */
const QR_SIDE = 26;

/** The left edge of a label's value, and of the grade column, in millimetres from the margin. */
const COLUMNS = { grade: 140, number: 0, subject: 12, value: 40 };

/** A calendar date `YYYY-MM-DD` as an Indonesian date writes it: `4 Mei 2026`. */
export const indonesianDate = (date: string) =>
  `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** A transcript value as Indonesian numbers write it: two decimals after a comma, `85,75`. */
export const indonesianValue = (value: number) =>
  value.toFixed(2).replace(".", ",");

/** Draws the QR code of a link as filled squares, its top left corner at `x`, `y`. */
const drawQr = (doc: jsPDF, link: string, x: number, y: number) => {
  const qr = encode(link, { border: 0, ecc: "M" });
  const cell = QR_SIDE / qr.size;
  Arr.forEach(qr.data, (row, rowIndex) =>
    Arr.forEach(row, (dark, columnIndex) => {
      if (dark) {
        doc.rect(x + columnIndex * cell, y + rowIndex * cell, cell, cell, "F");
      }
    })
  );
};

/**
 * Draws one SKL as an A4 PDF in Indonesian (ADR 0033, S6; Kepmendikdasmen 177/2026, Lampiran I
 * C): the title and the letter's number, the head's statement that names the decision on
 * graduation, the student's name, NISN, class group, and period, the subjects with their
 * transcript values and the average, the note that the letter holds until the ijazah is
 * issued, the place and date with the head's name and NIP or a dash, and the QR code of the
 * public check with the hash it checks. The PDF says it is checked by its hash and is not a
 * certified electronic signature.
 */
const draw = (letter: typeof PrintableLetter.Type) => {
  const doc = new jsPDF({ compress: true, format: "a4", unit: "mm" });
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const center = PAGE.width / 2;
  const width = right - left;
  const date = indonesianDate(letter.date);
  let y = PAGE.margin + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(letter.school, center, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`NPSN ${letter.npsn}`, center, y, { align: "center" });
  y += 3;
  doc.line(left, y, right, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SURAT KETERANGAN LULUS", center, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nomor: ${letter.number}`, center, y, { align: "center" });
  y += 10;

  const opening: string[] = doc.splitTextToSize(
    `Kepala ${letter.school}, berdasarkan Keputusan Kepala Satuan Pendidikan Nomor ${letter.decision} tanggal ${date} tentang Penetapan Kelulusan, menerangkan bahwa:`,
    width
  );
  doc.text(opening, left, y);
  y += opening.length * 5 + 3;
  for (const [label, value] of [
    ["Nama", letter.student],
    ["NISN", letter.nisn],
    ["Rombel", letter.cohort],
    ["Periode", letter.period],
  ] as const) {
    doc.text(label, left + 6, y);
    doc.text(`: ${value}`, left + COLUMNS.value, y);
    y += 6;
  }
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("dinyatakan LULUS", left, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    "dengan nilai yang akan ditulis dalam transkrip nilai sebagai berikut:",
    left + doc.getTextWidth("dinyatakan LULUS "),
    y
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("No", left + COLUMNS.number, y);
  doc.text("Mata Pelajaran", left + COLUMNS.subject, y);
  doc.text("Nilai", left + COLUMNS.grade, y);
  y += 2;
  doc.line(left, y, right, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  Arr.forEach(letter.subjects, (line, index) => {
    const subject: string[] = doc.splitTextToSize(
      line.subject,
      COLUMNS.grade - COLUMNS.subject - 4
    );
    doc.text(String(index + 1), left + COLUMNS.number, y);
    doc.text(subject, left + COLUMNS.subject, y);
    doc.text(indonesianValue(line.value), left + COLUMNS.grade, y);
    y += subject.length * 5 + 1;
  });
  doc.line(left, y - 3, right, y - 3);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Rata-rata", left + COLUMNS.subject, y);
  doc.text(indonesianValue(letter.average), left + COLUMNS.grade, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  const closing: string[] = doc.splitTextToSize(
    "Surat keterangan ini berlaku sementara sampai dengan diterbitkannya ijazah.",
    width
  );
  doc.text(closing, left, y);
  y += closing.length * 5 + 8;

  const signature = left + 100;
  doc.text(`${letter.place}, ${date}`, signature, y);
  y += 5;
  doc.text("Kepala Satuan Pendidikan,", signature, y);
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.text(letter.head, signature, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${letter.nip ?? "-"}`, signature, y);

  const footer = PAGE.height - PAGE.margin - QR_SIDE;
  drawQr(doc, letter.verifyUrl, left, footer);
  doc.setFontSize(8);
  const note = left + QR_SIDE + 6;
  doc.text(
    "Diperiksa melalui hash-nya. Bukan tanda tangan elektronik tersertifikasi.",
    note,
    footer + 8
  );
  doc.text(letter.hash, note, footer + 14);
  doc.text(letter.verifyUrl, note, footer + 20);

  return new Uint8Array(doc.output("arraybuffer"));
};

/** Draws one SKL's PDF; jsPDF draws synchronously, so a failure is a defect. */
export const drawLetterPdf = Effect.fn("records.letters.pdf")(function* (
  letter: typeof PrintableLetter.Type
) {
  return yield* Effect.sync(() => draw(letter));
});
