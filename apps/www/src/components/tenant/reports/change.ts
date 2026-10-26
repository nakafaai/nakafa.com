import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import { Array as Arr, Option, Schema } from "effect";
import { draftText } from "@/components/tenant/settings/state";

/** One line of a cohort's report list: a student, their report card or none, and what the viewer may do. */
export type ReportLine = Ref.Returns<
  typeof records.reports.sheet
>["page"][number];

/** A report card of one line. */
type LineReport = NonNullable<ReportLine["report"]>;

/** The cohort a report list belongs to. */
type CohortId = Ref.Args<typeof records.reports.sheet>["cohortId"];

/** The ID a started report holds until the server answers with its own. */
const draftReportId = () =>
  Schema.decodeUnknownSync(Id("reportCards"))(draftText());

/** Changes every line of every loaded page of the cohort's report lists, or of all of them. */
function changeLines(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  cohortId: CohortId | undefined,
  change: (line: ReportLine) => ReportLine
) {
  for (const query of localStore.getAllQueries(records.reports.sheet)) {
    if (
      Option.isSome(query.value) &&
      (cohortId === undefined || query.args.cohortId === cohortId)
    ) {
      localStore.setQuery(
        records.reports.sheet,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, change),
        })
      );
    }
  }
}

/** Shows a written note at once, on the student's draft, which the first note starts. */
export const writeChange: OptimisticUpdate<typeof records.reports.write> = (
  localStore,
  { cohortId, note, personId }
) =>
  changeLines(localStore, cohortId, (line) =>
    line.student.id === personId
      ? {
          ...line,
          can:
            line.report === null ? [...line.can, "report.complete"] : line.can,
          report: {
            approvedAt: null,
            hash: null,
            id: line.report?.id ?? draftReportId(),
            note,
            state: "draft",
          },
        }
      : line
  );

/** Shows a report in its next state at once, on every loaded list that holds it. */
export function stateChange(
  state: LineReport["state"]
): OptimisticUpdate<
  | typeof records.reports.complete
  | typeof records.reports.reopen
  | typeof records.reports.approve
> {
  return (localStore, { reportId }) =>
    changeLines(localStore, undefined, (line) =>
      line.report !== null && line.report.id === reportId
        ? { ...line, report: { ...line.report, state } }
        : line
    );
}
