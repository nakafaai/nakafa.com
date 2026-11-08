import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { CohortHolder } from "@repo/backend/confect/tenancy/hold";
import { Effect, Option } from "effect";

/** An exam sitting scheduled for the cohort, in any state, with the results it keeps. */
export const sittingsHolder: CohortHolder = {
  hold: "sittings",
  holds: Effect.fn("exams.sittings.hold")(function* (cohort) {
    const found = yield* (yield* DatabaseReader)
      .table("examSittings")
      .index("by_cohortId_and_state_and_opensAt", (query) =>
        query.eq("cohortId", cohort._id)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(found);
  }),
  references: ["examSittings.cohortId"],
};
