import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Option } from "effect";
import type { Cohort } from "@/components/tenant/settings/state";

type CohortOverview = Ref.Returns<typeof tenancy.cohorts.overview>;

/**
 * The cohorts table's rows: each cohort of the list with what the overview reads of it, its homeroom teacher and its
 * counts of students and classes, or none until the overview arrives. The table's columns read these from the row,
 * because a data table keeps the columns it first drew, so a column that read the overview itself would keep showing
 * what it read first.
 */
export function cohortRows(
  cohorts: readonly Cohort[],
  overview: CohortOverview | null
) {
  return Arr.map(cohorts, (cohort) => {
    const found = Arr.findFirst(overview ?? [], (row) => row.id === cohort.id);
    return {
      ...cohort,
      classes: Option.match(found, {
        onNone: () => null,
        onSome: (row) => row.classes,
      }),
      homeroom: Option.getOrElse(
        Option.flatMapNullishOr(found, (row) => row.homeroom),
        () => ""
      ),
      students: Option.match(found, {
        onNone: () => null,
        onSome: (row) => row.students,
      }),
    };
  });
}

export type CohortRow = ReturnType<typeof cohortRows>[number];
