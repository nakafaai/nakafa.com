import type { LetterInput } from "@repo/backend/confect/pdf/letter/contract";
import {
  indonesianDate,
  indonesianValue,
} from "@repo/backend/confect/pdf/letter/words";
import {
  Fact,
  Facts,
  IndexCell,
  NumberCell,
  Seal,
  Sheet,
  TableHead,
  TableRow,
  TableTotal,
  TextCell,
} from "@repo/backend/confect/pdf/parts";
import { Array as Arr } from "effect";
import type {} from "takumi-pdf/primitives";

/** The note a checked document carries, in Indonesian. */
const CHECK_NOTE =
  "Diperiksa melalui hash-nya. Bukan tanda tangan elektronik tersertifikasi.";

/**
 * The body of one SKL in Indonesian (ADR 0033, S6; Kepmendikdasmen 177/2026,
 * Lampiran I C), under the frame that names the school, its NPSN, the title,
 * and the letter's number: the head's statement that names the decision on
 * graduation, the student's name, NISN, class group, and period, the subjects
 * with their transcript values and the average, the note that the letter holds
 * until the ijazah is issued, the place and date with the head's name and NIP
 * or a dash, and the QR code of the public check with the hash it checks.
 */
export function LetterDocument({
  letter,
}: {
  letter: typeof LetterInput.Type;
}) {
  const date = indonesianDate(letter.date);

  return (
    <Sheet>
      <p tw="text-pretty">{`Kepala ${letter.school}, berdasarkan Keputusan Kepala Satuan Pendidikan Nomor ${letter.decision} tanggal ${date} tentang Penetapan Kelulusan, menerangkan bahwa:`}</p>
      <Facts>
        <Fact label="Nama" value={letter.student} />
        <Fact label="NISN" value={letter.nisn} />
        <Fact label="Rombel" value={letter.cohort} />
        <Fact label="Periode" value={letter.period} />
      </Facts>
      <p>
        <strong tw="font-semibold">dinyatakan LULUS</strong> dengan nilai yang
        akan ditulis dalam transkrip nilai sebagai berikut:
      </p>
      <section tw="flex flex-col">
        <TableHead>
          <IndexCell>No</IndexCell>
          <TextCell>Mata Pelajaran</TextCell>
          <NumberCell>Nilai</NumberCell>
        </TableHead>
        {Arr.map(letter.subjects, (line, index) => (
          <TableRow key={line.subject}>
            <IndexCell>{String(index + 1)}</IndexCell>
            <TextCell>{line.subject}</TextCell>
            <NumberCell>{indonesianValue(line.value)}</NumberCell>
          </TableRow>
        ))}
        <TableTotal>
          <IndexCell />
          <TextCell>Rata-rata</TextCell>
          <NumberCell>{indonesianValue(letter.average)}</NumberCell>
        </TableTotal>
      </section>
      <p>
        Surat keterangan ini berlaku sementara sampai dengan diterbitkannya
        ijazah.
      </p>
      <section
        style={{ breakInside: "avoid" }}
        tw="flex w-64 flex-col self-end"
      >
        <span>{`${letter.place}, ${date}`}</span>
        <span tw="mb-16">Kepala Satuan Pendidikan,</span>
        <span tw="font-semibold">{letter.head}</span>
        <span>{`NIP. ${letter.nip ?? "-"}`}</span>
      </section>
      <Seal hash={letter.hash} link={letter.verifyUrl} note={CHECK_NOTE} />
    </Sheet>
  );
}
