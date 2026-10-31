import "takumi-pdf/primitives";
import { Seal, Sheet } from "@repo/pdf/parts";
import type { ReportInput } from "@repo/pdf/report/contract";
import { REPORT_COPY } from "@repo/pdf/report/copy";
import { Array as Arr, DateTime } from "effect";

/**
 * One report card (ADR 0033, S5): the school, the student, the class group, the
 * period, one line per subject, the homeroom teacher's note, the approval date,
 * and the QR code of the public check with the hash it checks. It says it is
 * checked by its hash and is not a certified electronic signature.
 */
export function ReportDocument({
  report,
}: {
  report: typeof ReportInput.Type;
}) {
  const copy = REPORT_COPY[report.locale];
  const approvedOn = DateTime.formatIsoDateUtc(
    DateTime.makeUnsafe(report.approvedAt)
  );

  return (
    <Sheet>
      <header tw="flex items-start justify-between gap-6">
        <h1 tw="text-[16pt] font-semibold">{copy.title}</h1>
        <span tw="text-[11pt] font-semibold">{report.school}</span>
      </header>
      <section tw="grid grid-cols-[10rem_1fr] gap-y-1">
        <span>{copy.student}</span>
        <span>{report.student}</span>
        <span>{copy.class}</span>
        <span>{report.cohort}</span>
        <span>{copy.period}</span>
        <span>{report.period}</span>
      </section>
      <section tw="flex flex-col">
        <div tw="grid grid-cols-[1fr_4rem_9rem] gap-3 border-b border-gray-900 pb-1 font-semibold">
          <span>{copy.subject}</span>
          <span>{copy.grade}</span>
          <span>{copy.result}</span>
        </div>
        {Arr.map(report.subjects, (subject) => (
          <div
            key={subject.className}
            tw="grid grid-cols-[1fr_4rem_9rem] gap-3 py-1"
          >
            <span>{subject.className}</span>
            <span>{String(subject.value)}</span>
            <span>
              {subject.band ??
                (subject.kktp === "reached"
                  ? copy.kktpReached
                  : copy.kktpNotReached)}
            </span>
          </div>
        ))}
      </section>
      <section tw="flex flex-col gap-1">
        <span tw="font-semibold">{copy.note}</span>
        <p>{report.note}</p>
      </section>
      <span>{`${copy.approved} ${approvedOn}`}</span>
      <Seal hash={report.hash} link={report.verifyUrl} note={copy.check} />
    </Sheet>
  );
}
