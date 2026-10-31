import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import type { UnitId } from "@/components/tenant/settings/unit";
import { readOnce } from "@/lib/convex/read";

/** A unit with no active period, which an import or an export of its roster needs. */
export class RosterPeriodMissing extends Schema.TaggedError<RosterPeriodMissing>()(
  "RosterPeriodMissing",
  {}
) {}

/**
 * The unit's active period, read when an import or an export needs it. The page's header draws its
 * actions from the first paint and waits for nothing, so each action reads the period itself after
 * the press, and a unit with no active period refuses it.
 */
export const activePeriodOf = Effect.fn("tenant.roster.activePeriod")(
  function* (slug: TenantSlug, unitId: UnitId) {
    const period = yield* readOnce(tenancy.cohorts.activePeriod, {
      slug,
      unitId,
    });
    if (period === null) {
      return yield* new RosterPeriodMissing();
    }
    return period;
  }
);
