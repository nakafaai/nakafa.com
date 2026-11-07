import type { GenericId } from "@confect/core";
import type { TenantPeriodsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeHomeroomOf } from "@repo/backend/confect/tenancy/authority";
import type {
  CohortHold,
  PeriodHold,
} from "@repo/backend/confect/tenancy/errors";
import { Effect, Option } from "effect";

/**
 * The first record that keeps a cohort in use, in the order a school would clear them, or none for a cohort that holds
 * nothing and may be deleted. A removed homeroom teacher's row does not count: deleting the cohort clears it. Each kind
 * is one indexed read of its first row.
 */
export const cohortHold = Effect.fn("tenancy.write.holds.cohort")(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const reader = yield* DatabaseReader;
  const held = yield* Effect.all(
    [
      reader
        .table("tenantCohortMembers")
        .index("by_cohortId_and_personId", (query) =>
          query.eq("cohortId", cohortId)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof CohortHold.Type>("members"))
        ),
      Effect.map(
        activeHomeroomOf(cohortId),
        Option.as<typeof CohortHold.Type>("homeroom")
      ),
      reader
        .table("classes")
        .index("by_cohortId_and_status_and_nameKey", (query) =>
          query.eq("cohortId", cohortId)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof CohortHold.Type>("classes"))
        ),
      reader
        .table("examSittings")
        .index("by_cohortId_and_state_and_opensAt", (query) =>
          query.eq("cohortId", cohortId)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof CohortHold.Type>("sittings"))
        ),
      reader
        .table("reportCards")
        .index("by_cohortId_and_personId", (query) =>
          query.eq("cohortId", cohortId)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof CohortHold.Type>("reports"))
        ),
      reader
        .table("graduationLetters")
        .index("by_cohortId_and_personId", (query) =>
          query.eq("cohortId", cohortId)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof CohortHold.Type>("letters"))
        ),
    ],
    { concurrency: "unbounded" }
  );
  return Option.firstSomeOf(held);
});

/**
 * The first reason a period stays in use, or none for a period that may be deleted: being the active period, or a
 * cohort, a class, or a promotion from or into it. A class and a promotion point at a period beside its cohorts, so
 * each is read on its own. Each kind is one indexed read of its first row.
 */
export const periodHold = Effect.fn("tenancy.write.holds.period")(function* (
  period: Pick<TenantPeriodsDoc, "_id" | "status">
) {
  if (period.status === "active") {
    return Option.some<typeof PeriodHold.Type>("active");
  }
  const reader = yield* DatabaseReader;
  const held = yield* Effect.all(
    [
      reader
        .table("tenantCohorts")
        .index("by_periodId_and_nameKey", (query) =>
          query.eq("periodId", period._id)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof PeriodHold.Type>("cohorts"))
        ),
      reader
        .table("classes")
        .index("by_periodId_and_slug", (query) =>
          query.eq("periodId", period._id)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof PeriodHold.Type>("classes"))
        ),
      reader
        .table("tenantPromotions")
        .index("by_sourcePeriodId_and_state", (query) =>
          query.eq("sourcePeriodId", period._id)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof PeriodHold.Type>("promotions"))
        ),
      reader
        .table("tenantPromotions")
        .index("by_targetPeriodId_and_state", (query) =>
          query.eq("targetPeriodId", period._id)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.as<typeof PeriodHold.Type>("promotions"))
        ),
    ],
    { concurrency: "unbounded" }
  );
  return Option.firstSomeOf(held);
});
