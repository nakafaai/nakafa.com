import "takumi-pdf/primitives";
import type { LetterInput } from "@repo/pdf/letter/contract";
import { indonesianDate, indonesianValue } from "@repo/pdf/letter/words";
import { Seal, Sheet } from "@repo/pdf/parts";
import { Array as Arr } from "effect";

/** The note a checked document carries, in Indonesian. */
const CHECK_NOTE =
  "Diperiksa melalui hash-nya. Bukan tanda tangan elektronik tersertifikasi.";

/**
 * One SKL in Indonesian (ADR 0033, S6; Kepmendikdasmen 177/2026, Lampiran I C):
 * the title and the letter's number, the head's statement that names the decision
 * on graduation, the student's name, NISN, class group, and period, the subjects
 * with their transcript values and the average, the note that the letter holds
 * until the ijazah is issued, the place and date with the head's name and NIP or a
 * dash, and the QR code of the public check with the hash it checks.
 */
export function LetterDocument({
  letter,
}: {
  letter: typeof LetterInput.Type;
}) {
  const date = indonesianDate(letter.date);

  return (
    <Sheet>
      <header tw="flex flex-col items-center gap-1 border-b border-gray-900 pb-2">
        <h1 tw="text-[12pt] font-semibold">{letter.school}</h1>
        <span tw="text-[9pt]">{`NPSN ${letter.npsn}`}</span>
      </header>
      <section tw="flex flex-col items-center gap-1">
        <h2 tw="text-[13pt] font-semibold">SURAT KETERANGAN LULUS</h2>
        <span>{`Nomor: ${letter.number}`}</span>
      </section>
      <p>{`Kepala ${letter.school}, berdasarkan Keputusan Kepala Satuan Pendidikan Nomor ${letter.decision} tanggal ${date} tentang Penetapan Kelulusan, menerangkan bahwa:`}</p>
      <section tw="grid grid-cols-[6rem_1fr] gap-y-1 ps-4">
        <span>Nama</span>
        <span>{`: ${letter.student}`}</span>
        <span>NISN</span>
        <span>{`: ${letter.nisn}`}</span>
        <span>Rombel</span>
        <span>{`: ${letter.cohort}`}</span>
        <span>Periode</span>
        <span>{`: ${letter.period}`}</span>
      </section>
      <p>
        <strong tw="font-semibold">dinyatakan LULUS</strong> dengan nilai yang
        akan ditulis dalam transkrip nilai sebagai berikut:
      </p>
      <section tw="flex flex-col">
        <div tw="grid grid-cols-[2rem_1fr_4rem] gap-3 border-b border-gray-900 pb-1 font-semibold">
          <span>No</span>
          <span>Mata Pelajaran</span>
          <span>Nilai</span>
        </div>
        {Arr.map(letter.subjects, (line, index) => (
          <div
            key={line.subject}
            tw="grid grid-cols-[2rem_1fr_4rem] gap-3 py-1"
          >
            <span>{String(index + 1)}</span>
            <span>{line.subject}</span>
            <span>{indonesianValue(line.value)}</span>
          </div>
        ))}
        <div tw="grid grid-cols-[2rem_1fr_4rem] gap-3 border-t border-gray-900 pt-1 font-semibold">
          <span />
          <span>Rata-rata</span>
          <span>{indonesianValue(letter.average)}</span>
        </div>
      </section>
      <p>
        Surat keterangan ini berlaku sementara sampai dengan diterbitkannya
        ijazah.
      </p>
      <section tw="flex flex-col self-end gap-1">
        <span>{`${letter.place}, ${date}`}</span>
        <span tw="mb-16">Kepala Satuan Pendidikan,</span>
        <span tw="font-semibold">{letter.head}</span>
        <span>{`NIP. ${letter.nip ?? "-"}`}</span>
      </section>
      <Seal hash={letter.hash} link={letter.verifyUrl} note={CHECK_NOTE} />
    </Sheet>
  );
}
