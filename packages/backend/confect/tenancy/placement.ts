import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Cohort placements one Person may hold across all periods. A Person is placed
 * at most once per period, and an Indonesian school year has two semesters,
 * ganjil and genap, so a unit opens about two periods a year. These 64 placements
 * cover 32 years of periods in one unit. Removing a Person reads at most this
 * many placements, and the period and cohort of each one, which is 192 documents
 * at most for them. A query or mutation may scan 32,000 documents (the
 * Transactions limits at docs.convex.dev/production/state/limits, read on 14
 * October 2026). A placement past this limit is refused.
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
