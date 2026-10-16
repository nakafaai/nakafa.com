import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  periodAuthority,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  PeriodActive,
  SourcePeriodInvalid,
} from "@repo/backend/confect/tenancy/errors";
import type { PeriodStatus } from "@repo/backend/confect/tenancy/period";
import { Effect, Option, Schema, Struct } from "effect";

/** What one run of a step left: whether it read its last page, and where the next page starts. */
export const StepOutcome = Schema.Struct({
  complete: Schema.Boolean,
  cursor: Schema.NullOr(Schema.String),
});

/** The outcome of a step that finished in one run. */
export const finished: typeof StepOutcome.Type = {
  complete: true,
  cursor: null,
};

/** The active source period of a promotion, which the first step archives. */
const readSourcePeriod = Effect.fn("tenancy.promotionSteps.source")(function* (
  promotion: TenantPromotionsDoc
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(promotion.sourcePeriodId)
    .pipe(Effect.orDie);
});

/** Archives the active source period, the first step of applying a promotion. */
export const archiveApply = Effect.fn("tenancy.promotionSteps.archiveApply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const period = yield* readSourcePeriod(promotion);
    if (period.status !== "active") {
      return yield* new SourcePeriodInvalid();
    }
    const status: typeof PeriodStatus.Type = "archived";
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(
        period._id,
        Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* periodAuthority.record(actor, period, { type: "period.archived" });
    return finished;
  }
);

/**
 * Makes the archived source period active again, the inverse of archiving it. Only
 * an applied promotion undoes this. It is refused while another period of the unit
 * is active: a unit has at most one active period, and the source stays archived
 * until this undo, so an active period is one opened while the promotion ran.
 */
export const archiveUndo = Effect.fn("tenancy.promotionSteps.archiveUndo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const period = yield* readSourcePeriod(promotion);
    const active = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", promotion.unitId).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(active)) {
      return yield* new PeriodActive();
    }
    const status: typeof PeriodStatus.Type = "active";
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(
        period._id,
        Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* promotionAuthority.record(actor, promotion, {
      step: "archive",
      type: "promotion.undone",
    });
    return finished;
  }
);

/** Replaces the fields of one promotion row, keeping its other fields as they are. */
export const patchPromotion = (
  promotion: TenantPromotionsDoc,
  fields: Partial<Pick<TenantPromotionsDoc, "copies" | "created">>
) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("tenantPromotions")
      .patch(promotion._id, fields)
      .pipe(Effect.orDie)
  );
