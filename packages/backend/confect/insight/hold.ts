import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PeriodHolder } from "@repo/backend/confect/tenancy/hold";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The Insight of a period's students: their standings, what teachers wrote about them, and Nina's drafts. An archived
 * period keeps it for `INSIGHT_RETENTION`, so a school that restores the period finds it whole, and the period may be
 * deleted once the retention job has removed it.
 */
export const insightHolder: PeriodHolder = {
  hold: "insight",
  holds: Effect.fn("insight.hold")(function* (period) {
    const reader = yield* DatabaseReader;
    const found = yield* Effect.all(
      [
        reader
          .table("insightMastery")
          .index("by_periodId", (query) => query.eq("periodId", period._id))
          .first()
          .pipe(Effect.map(Option.isSome)),
        reader
          .table("insightNarratives")
          .index("by_periodId", (query) => query.eq("periodId", period._id))
          .first()
          .pipe(Effect.map(Option.isSome)),
        reader
          .table("insightDrafts")
          .index("by_periodId", (query) => query.eq("periodId", period._id))
          .first()
          .pipe(Effect.map(Option.isSome)),
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.orDie);
    return Arr.contains(found, true);
  }),
  references: [
    "insightDrafts.periodId",
    "insightMastery.periodId",
    "insightNarratives.periodId",
  ],
};
