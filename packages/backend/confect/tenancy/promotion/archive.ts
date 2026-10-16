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
import { finished } from "@repo/backend/confect/tenancy/promotion/progress";
import { Effect, Option, Struct } from "effect";

/** The source period of a promotion, which the first step archives. */
const readSourcePeriod = Effect.fn("tenancy.promotion.archive.source")(
  function* (promotion: TenantPromotionsDoc) {
    return yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .get(promotion.sourcePeriodId)
      .pipe(Effect.orDie);
  }
);

/** Archives the active source period, the first step of applying a promotion. */
export const archiveApply = Effect.fn("tenancy.promotion.archive.apply")(
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
export const archiveUndo = Effect.fn("tenancy.promotion.archive.undo")(
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
