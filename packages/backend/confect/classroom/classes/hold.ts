import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  CohortHolder,
  PeriodHolder,
} from "@repo/backend/confect/tenancy/hold";
import { Effect, Option } from "effect";

/** A class of the cohort, archived or not: a class is never deleted, so its cohort stays. */
export const classCohortHolder: CohortHolder = {
  hold: "classes",
  holds: Effect.fn("classroom.classes.hold.cohort")(function* (cohort) {
    const found = yield* (yield* DatabaseReader)
      .table("classes")
      .index("by_cohortId_and_status_and_nameKey", (query) =>
        query.eq("cohortId", cohort._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["classes.cohortId"],
};

/** A class of the period. Its subject teachers point at the same period, which the class holds. */
export const classPeriodHolder: PeriodHolder = {
  hold: "classes",
  holds: Effect.fn("classroom.classes.hold.period")(function* (period) {
    const found = yield* (yield* DatabaseReader)
      .table("classes")
      .index("by_periodId_and_slug", (query) =>
        query.eq("periodId", period._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["classes.periodId"],
};
