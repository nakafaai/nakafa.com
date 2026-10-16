import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { promotionAuthority } from "@repo/backend/confect/tenancy/authority";
import { SourcePeriodInvalid } from "@repo/backend/confect/tenancy/errors";
import { finished } from "@repo/backend/confect/tenancy/promotion/progress";
import {
  archivePeriod,
  reactivatePeriod,
} from "@repo/backend/confect/tenancy/write/period";
import { Effect } from "effect";

/** The source period of a promotion, which the first step archives. */
const readSourcePeriod = Effect.fn("tenancy.promotion.archive.source")(
  function* (promotion: TenantPromotionsDoc) {
    return yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .get(promotion.sourcePeriodId)
      .pipe(Effect.orDie);
  }
);

/**
 * Archives the active source period, the first step of applying a promotion. A source
 * that is not active stops the step as a source the plan no longer fits.
 */
export const archiveApply = Effect.fn("tenancy.promotion.archive.apply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const period = yield* readSourcePeriod(promotion);
    yield* archivePeriod(actor, period).pipe(
      Effect.catchTag("PeriodNotActive", () =>
        Effect.fail(new SourcePeriodInvalid())
      )
    );
    return finished;
  }
);

/**
 * Makes the archived source period active again, the inverse of archiving it. Only
 * an applied promotion undoes this. The write refuses it while another period of the
 * unit is active: a unit has at most one active period, and the source stays archived
 * until this undo, so an active period is one opened while the promotion ran.
 */
export const archiveUndo = Effect.fn("tenancy.promotion.archive.undo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    yield* reactivatePeriod(yield* readSourcePeriod(promotion));
    yield* promotionAuthority.record(actor, promotion, {
      step: "archive",
      type: "promotion.undone",
    });
    return finished;
  }
);
