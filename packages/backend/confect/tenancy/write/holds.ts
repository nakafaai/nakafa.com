import type {
  TenantCohortsDoc,
  TenantPeriodsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  classCohortHolder,
  classPeriodHolder,
} from "@repo/backend/confect/classroom/classes/hold";
import { sittingsHolder } from "@repo/backend/confect/exams/sittings/hold";
import { insightHolder } from "@repo/backend/confect/insight/hold";
import {
  gradesHolder,
  graduationsHolder,
  lettersHolder,
  reportsHolder,
} from "@repo/backend/confect/records/hold";
import { activeHomeroomOf } from "@repo/backend/confect/tenancy/authority";
import type { PeriodHold } from "@repo/backend/confect/tenancy/errors";
import type {
  CohortHolder,
  Holder,
  PeriodHolder,
} from "@repo/backend/confect/tenancy/hold";
import {
  promotionCohortHolder,
  promotionPeriodHolder,
} from "@repo/backend/confect/tenancy/promotion/hold";
import { Effect, Option } from "effect";

/** A student placed in the cohort. Their placement points at the cohort's period, which the cohort holds. */
const membersHolder: CohortHolder = {
  hold: "members",
  holds: Effect.fn("tenancy.write.holds.members")(function* (cohort) {
    const found = yield* (yield* DatabaseReader)
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", cohort._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["tenantCohortMembers.cohortId"],
};

/** The cohort's homeroom teacher, while they still hold the slot: deleting the cohort clears a removed teacher's row. */
const homeroomHolder: CohortHolder = {
  hold: "homeroom",
  holds: (cohort) => Effect.map(activeHomeroomOf(cohort._id), Option.isSome),
  references: ["tenantAssignments.cohortId"],
};

/** A cohort of the period, which every row of the cohort leans on for its own period. */
const cohortsHolder: PeriodHolder = {
  hold: "cohorts",
  holds: Effect.fn("tenancy.write.holds.cohorts")(function* (period) {
    const found = yield* (yield* DatabaseReader)
      .table("tenantCohorts")
      .index("by_periodId_and_nameKey", (query) =>
        query.eq("periodId", period._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["tenantCohorts.periodId"],
};

/** Every record that keeps a cohort in use, in the order a school would clear them. */
export const cohortHolders: readonly CohortHolder[] = [
  membersHolder,
  homeroomHolder,
  classCohortHolder,
  sittingsHolder,
  reportsHolder,
  lettersHolder,
  promotionCohortHolder,
];

/** Every record that keeps a period in use, in the order a school would clear them. */
export const periodHolders: readonly PeriodHolder[] = [
  cohortsHolder,
  classPeriodHolder,
  gradesHolder,
  graduationsHolder,
  promotionPeriodHolder,
  insightHolder,
];

/** The first hold among the holders that the subject has, in their order, reading every holder at once. */
const firstHold = <Subject, Hold>(
  holders: readonly Holder<Subject, Hold>[],
  subject: Subject
) =>
  Effect.map(
    Effect.forEach(
      holders,
      (holder) =>
        Effect.map(holder.holds(subject), (held) =>
          held ? Option.some(holder.hold) : Option.none()
        ),
      { concurrency: "unbounded" }
    ),
    Option.firstSomeOf
  );

/** The first record that keeps a cohort in use, or none for a cohort that holds nothing and may be deleted. */
export const cohortHold = Effect.fn("tenancy.write.holds.cohort")(function* (
  cohort: Pick<TenantCohortsDoc, "_id" | "periodId">
) {
  return yield* firstHold(cohortHolders, cohort);
});

/** The first reason a period stays in use, being the active period or a record that points at it, or none. */
export const periodHold = Effect.fn("tenancy.write.holds.period")(function* (
  period: Pick<TenantPeriodsDoc, "_id" | "status">
) {
  if (period.status === "active") {
    return Option.some<typeof PeriodHold.Type>("active");
  }
  return yield* firstHold(periodHolders, period);
});
