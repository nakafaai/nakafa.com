import { Id } from "@repo/backend/confect/_generated/id";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** Cohorts one period may hold, archived ones included. Every list of cohorts reads at most this many. */
export const COHORT_LIMIT = 200;

/** A cohort's name, one line, unique within its period without regard to case. */
export const CohortName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(40)
);

/** A cohort is active until it is archived, and an archived cohort stays readable. */
export const CohortStatus = Schema.Literals(["active", "archived"]);

/** A cohort's school year, an integer from 1 to 13. */
export const CohortGrade = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 13 })
);

/** The name in the form that uniqueness and order compare: the lowercase name. */
export const cohortNameKey = (name: string) => name.toLowerCase();

/**
 * A cohort of one period. `nameKey` is `cohortNameKey(name)`, written with the
 * name, so a case-insensitive uniqueness check is one indexed read.
 */
export const tenantCohortValidator = Schema.Struct({
  grade: CohortGrade,
  name: CohortName,
  nameKey: Schema.String,
  periodId: Id("tenantPeriods"),
  status: CohortStatus,
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
});
