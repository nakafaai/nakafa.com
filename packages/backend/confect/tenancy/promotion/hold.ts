import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  CohortHolder,
  PeriodHolder,
} from "@repo/backend/confect/tenancy/hold";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The promotions of one period that one cohort check reads. A period gets a new promotion only once its last one was
 * cancelled, so a few rows cover every school. A period that fills the page counts as held, so a cohort is never
 * deleted under a promotion that the read did not reach.
 */
export const PROMOTION_SCAN = 20;

/** A promotion from or into the period, in any state: a cancelled or opened one keeps its plan as history. */
export const promotionPeriodHolder: PeriodHolder = {
  hold: "promotions",
  holds: Effect.fn("tenancy.promotion.hold.period")(function* (period) {
    const reader = yield* DatabaseReader;
    const found = yield* Effect.all(
      [
        reader
          .table("tenantPromotions")
          .index("by_sourcePeriodId_and_state", (query) =>
            query.eq("sourcePeriodId", period._id)
          )
          .first(),
        reader
          .table("tenantPromotions")
          .index("by_targetPeriodId_and_state", (query) =>
            query.eq("targetPeriodId", period._id)
          )
          .first(),
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.orDie);
    return Arr.some(found, Option.isSome);
  }),
  references: [
    "tenantPromotions.sourcePeriodId",
    "tenantPromotions.targetPeriodId",
  ],
};

/** Undo deletes the cohorts a promotion created, so while its cohorts step runs backwards they are its own work. */
const undoingCohorts = (promotion: TenantPromotionsDoc) =>
  promotion.progress.direction === "undo" &&
  promotion.progress.step === "cohorts";

/**
 * A promotion, in any state, whose plan names the cohort as a source, or that created it. A source cohort belongs to
 * the period the promotion starts from, and a created one to the period it fills, so each side is one read of that
 * period's promotions.
 */
export const promotionCohortHolder: CohortHolder = {
  hold: "promotions",
  holds: Effect.fn("tenancy.promotion.hold.cohort")(function* (cohort) {
    const reader = yield* DatabaseReader;
    const [from, into] = yield* Effect.all(
      [
        reader
          .table("tenantPromotions")
          .index("by_sourcePeriodId_and_state", (query) =>
            query.eq("sourcePeriodId", cohort.periodId)
          )
          .take(PROMOTION_SCAN),
        reader
          .table("tenantPromotions")
          .index("by_targetPeriodId_and_state", (query) =>
            query.eq("targetPeriodId", cohort.periodId)
          )
          .take(PROMOTION_SCAN),
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.orDie);
    return (
      from.length === PROMOTION_SCAN ||
      into.length === PROMOTION_SCAN ||
      Arr.some(from, (promotion) =>
        Arr.some(promotion.sources, (source) => source.cohortId === cohort._id)
      ) ||
      Arr.some(
        into,
        (promotion) =>
          !undoingCohorts(promotion) &&
          Arr.some(
            promotion.created,
            (created) => created.cohortId === cohort._id
          )
      )
    );
  }),
  references: [
    "tenantPromotions.created[].cohortId",
    "tenantPromotions.sources[].cohortId",
  ],
};
