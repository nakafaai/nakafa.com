import {
  Fact,
  Facts,
  NumberCell,
  Seal,
  Section,
  Sheet,
  TableHead,
  TableRow,
  TextCell,
  WordCell,
} from "@repo/backend/confect/pdf/parts";
import type { ReportInput } from "@repo/backend/confect/pdf/report/contract";
import { REPORT_COPY } from "@repo/backend/confect/pdf/report/copy";
import { formatterOf } from "@repo/internationalization/src/formats";
import { Array as Arr, DateTime } from "effect";
import type {} from "takumi-pdf/primitives";

/**
 * The body of one report card (ADR 0033, S5): the student, the class group, the
 * period, and the approval date, one line per subject, the homeroom teacher's
 * note, and the QR code of the public check with the hash it checks. It says it
 * is checked by its hash and is not a certified electronic signature.
 */
export function ReportDocument({
  report,
}: {
  report: typeof ReportInput.Type;
}) {
  const copy = REPORT_COPY[report.locale];
  const formatter = formatterOf(report.locale);

  return (
    <Sheet>
      <Facts>
        <Fact label={copy.student} value={report.student} />
        <Fact label={copy.class} value={report.cohort} />
        <Fact label={copy.period} value={report.period} />
        <Fact
          label={copy.approved}
          value={DateTime.formatUtc(DateTime.makeUnsafe(report.approvedAt), {
            dateStyle: "long",
            locale: report.locale,
          })}
        />
      </Facts>
      <section tw="flex flex-col">
        <TableHead>
          <TextCell>{copy.subject}</TextCell>
          <NumberCell>{copy.grade}</NumberCell>
          <WordCell>{copy.result}</WordCell>
        </TableHead>
        {Arr.map(report.subjects, (subject) => (
          <TableRow key={subject.className}>
            <TextCell>{subject.className}</TextCell>
            <NumberCell>{formatter.number(subject.value, "grade")}</NumberCell>
            <WordCell>
              {subject.band ??
                (subject.kktp === "reached"
                  ? copy.kktpReached
                  : copy.kktpNotReached)}
            </WordCell>
          </TableRow>
        ))}
      </section>
      <Section title={copy.note}>
        <p tw="text-pretty">{report.note}</p>
      </Section>
      <Seal hash={report.hash} link={report.verifyUrl} note={copy.check} />
    </Sheet>
  );
}
