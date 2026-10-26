import type { PrintableReport } from "@repo/backend/confect/records/report";
import { Array as Arr, DateTime, Effect } from "effect";
import { jsPDF } from "jspdf";
import { encode } from "uqr";

/** The words of a report PDF, in each language a school's unit may set. */
const COPY = {
  de: {
    approved: "Genehmigt am",
    check:
      "Geprüft über seinen Hash. Keine zertifizierte elektronische Signatur.",
    class: "Klasse",
    grade: "Note",
    kktpNotReached: "Unter dem KKTP",
    kktpReached: "Erreicht das KKTP",
    note: "Bemerkung der Klassenleitung",
    period: "Zeitraum",
    result: "Ergebnis",
    student: "Schüler",
    subject: "Fach",
    title: "Zeugnis",
  },
  en: {
    approved: "Approved on",
    check: "Checked by its hash. Not a certified electronic signature.",
    class: "Class group",
    grade: "Grade",
    kktpNotReached: "Below KKTP",
    kktpReached: "Meets KKTP",
    note: "Homeroom teacher's note",
    period: "Period",
    result: "Result",
    student: "Student",
    subject: "Subject",
    title: "Report card",
  },
  id: {
    approved: "Disetujui pada",
    check:
      "Diperiksa melalui hash-nya. Bukan tanda tangan elektronik tersertifikasi.",
    class: "Rombel",
    grade: "Nilai",
    kktpNotReached: "Di bawah KKTP",
    kktpReached: "Mencapai KKTP",
    note: "Catatan wali kelas",
    period: "Periode",
    result: "Hasil",
    student: "Peserta didik",
    subject: "Mata pelajaran",
    title: "Laporan Hasil Belajar",
  },
};

/** The A4 page in millimetres, and the margin every line keeps. */
const PAGE = { margin: 18, width: 210 };

/** The side of the QR code on the page, in millimetres. */
const QR_SIDE = 28;

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
 * Draws one report card as an A4 PDF (ADR 0033, S5): the school, the period, the
 * cohort, the student, one line per subject, the homeroom teacher's note, the approval
 * date, and the QR code of the public check with the hash it checks. The PDF says it is
 * checked by its hash and is not a certified electronic signature.
 */
const draw = (report: typeof PrintableReport.Type) => {
  const copy = COPY[report.locale];
  const doc = new jsPDF({ compress: true, format: "a4", unit: "mm" });
  const right = PAGE.width - PAGE.margin;
  let y = PAGE.margin + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(copy.title, PAGE.margin, y);
  doc.setFontSize(11);
  doc.text(report.school, right, y, { align: "right" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [label, value] of [
    [copy.student, report.student],
    [copy.class, report.cohort],
    [copy.period, report.period],
  ] as const) {
    doc.text(label, PAGE.margin, y);
    doc.text(value, PAGE.margin + 40, y);
    y += 6;
  }
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.text(copy.subject, PAGE.margin, y);
  doc.text(copy.grade, PAGE.margin + 110, y);
  doc.text(copy.result, PAGE.margin + 130, y);
  y += 2;
  doc.line(PAGE.margin, y, right, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  for (const subject of report.subjects) {
    doc.text(subject.className, PAGE.margin, y);
    doc.text(String(subject.value), PAGE.margin + 110, y);
    doc.text(
      subject.band ??
        (subject.kktp === "reached" ? copy.kktpReached : copy.kktpNotReached),
      PAGE.margin + 130,
      y
    );
    y += 6;
  }
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(copy.note, PAGE.margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const noteLines: string[] = doc.splitTextToSize(
    report.note,
    right - PAGE.margin
  );
  doc.text(noteLines, PAGE.margin, y);
  y += noteLines.length * 5 + 8;

  const approvedOn = DateTime.formatIsoDateUtc(
    DateTime.makeUnsafe(report.approvedAt)
  );
  doc.text(`${copy.approved} ${approvedOn}`, PAGE.margin, y);

  const footer = 297 - PAGE.margin - QR_SIDE;
  drawQr(doc, report.verifyUrl, PAGE.margin, footer);
  doc.setFontSize(8);
  doc.text(copy.check, PAGE.margin + QR_SIDE + 6, footer + 8);
  doc.text(report.hash, PAGE.margin + QR_SIDE + 6, footer + 14);
  doc.text(report.verifyUrl, PAGE.margin + QR_SIDE + 6, footer + 20);

  return new Uint8Array(doc.output("arraybuffer"));
};

/** Draws one report card's PDF; jsPDF draws synchronously, so a failure is a defect. */
export const drawReportPdf = Effect.fn("records.pdf.draw")(function* (
  report: typeof PrintableReport.Type
) {
  return yield* Effect.sync(() => draw(report));
});
