import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Cohort placements one Person may hold across all periods. Removing a Person
 * ends every one of them in the same transaction, so the count is bounded by
 * this limit, and a placement past it is refused.
 */
export const PERSON_PLACEMENT_LIMIT = 64;

/**
 * A Person placed in one cohort of one period: the `cohortMember` relation of
 * ADR 0012. A Person holds at most one placement per period.
 */
export const tenantCohortMemberValidator = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});
