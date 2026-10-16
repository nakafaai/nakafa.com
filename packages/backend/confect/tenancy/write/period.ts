import type { TenantPeriodsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { periodAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  PeriodActive,
  PeriodNotActive,
} from "@repo/backend/confect/tenancy/errors";
import type { PeriodStatus } from "@repo/backend/confect/tenancy/period";
import { Effect, Option, Struct } from "effect";

/** Replaces a period's status and keeps every other field of its row. */
const setStatus = Effect.fn("tenancy.write.period.setStatus")(function* (
  period: TenantPeriodsDoc,
  status: typeof PeriodStatus.Type
) {
  yield* (yield* DatabaseWriter)
    .table("tenantPeriods")
    .replace(
      period._id,
      Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
    )
    .pipe(Effect.orDie);
  return Struct.assign(period, { status });
});

/**
 * Archives an active period, which then stays readable and refuses writes, and
 * journals the archive. Only an active period can be archived.
 */
export const archivePeriod = Effect.fn("tenancy.write.period.archive")(
  function* (actor: typeof TenantActor.Type, period: TenantPeriodsDoc) {
    if (period.status !== "active") {
      return yield* new PeriodNotActive();
    }
    const archived = yield* setStatus(period, "archived");
    yield* periodAuthority.record(actor, period, { type: "period.archived" });
    return archived;
  }
);

/**
 * Makes an archived period active again, the inverse of archiving it. A unit holds
 * at most one active period, so this is refused while another period of the unit
 * is active. The caller journals the change it belongs to.
 */
export const reactivatePeriod = Effect.fn("tenancy.write.period.reactivate")(
  function* (period: TenantPeriodsDoc) {
    const active = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", period.unitId).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(active)) {
      return yield* new PeriodActive();
    }
    yield* setStatus(period, "active");
  }
);
