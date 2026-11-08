import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  CohortHolder,
  PeriodHolder,
} from "@repo/backend/confect/tenancy/hold";
import { Effect, Option } from "effect";

/** A report card of a student of the cohort. Its period is the cohort's, which the cohort holds. */
export const reportsHolder: CohortHolder = {
  hold: "reports",
  holds: Effect.fn("records.hold.reports")(function* (cohort) {
    const found = yield* (yield* DatabaseReader)
      .table("reportCards")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", cohort._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["reportCards.cohortId"],
};

/** A graduation letter of a student of the cohort. Its period is the cohort's, which the cohort holds. */
export const lettersHolder: CohortHolder = {
  hold: "letters",
  holds: Effect.fn("records.hold.letters")(function* (cohort) {
    const found = yield* (yield* DatabaseReader)
      .table("graduationLetters")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", cohort._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["graduationLetters.cohortId"],
};

/** A subject grade given in the period. */
export const gradesHolder: PeriodHolder = {
  hold: "grades",
  holds: Effect.fn("records.hold.grades")(function* (period) {
    const found = yield* (yield* DatabaseReader)
      .table("classGrades")
      .index("by_periodId_and_state", (query) =>
        query.eq("periodId", period._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["classGrades.periodId"],
};

/** The graduation decision of a unit in the period. */
export const graduationsHolder: PeriodHolder = {
  hold: "graduations",
  holds: Effect.fn("records.hold.graduations")(function* (period) {
    const found = yield* (yield* DatabaseReader)
      .table("graduations")
      .index("by_periodId", (query) => query.eq("periodId", period._id))
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["graduations.periodId"],
};
