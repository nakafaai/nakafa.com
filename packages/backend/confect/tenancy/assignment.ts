import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The kinds of teacher assignment to a cohort. Subject teachers come with the classroom lane. */
export const AssignmentKind = Schema.Literals(["homeroom"]);

/**
 * A teacher assigned to one cohort in one period. A homeroom assignment (wali
 * kelas) gives the teacher the `homeroom` relation of ADR 0012 to that cohort.
 * A cohort holds at most one homeroom teacher, and a teacher at most one
 * homeroom cohort per period, so each check is one indexed read.
 */
export const tenantAssignmentValidator = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  kind: AssignmentKind,
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});
