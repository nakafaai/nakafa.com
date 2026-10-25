import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { periodAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  type PeriodStatus,
  periodView,
} from "@repo/backend/confect/tenancy/period";
import spec from "@repo/backend/confect/tenancy/periods.spec";
import { reactivatePeriod } from "@repo/backend/confect/tenancy/write/period";
import { Effect, Struct } from "effect";

/**
 * Restores an archived period to active, the inverse of archiving it. An archived period refuses
 * every action on its own row, so the school's Admin restores it at the school level. The period
 * must belong to the school, and its unit must be open. A unit holds at most one active period, so
 * the restore is refused while another period of the unit is active. A period that is not archived
 * changes nothing.
 */
export const restore = FunctionImpl.make(
  databaseSchema,
  spec,
  "restore",
  Effect.fn("tenancy.periods.restore")(function* ({ periodId }) {
    const { person, tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const period = yield* reader
      .table("tenantPeriods")
      .get(periodId)
      .pipe(
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIdFailure: () =>
            new AccessDenied({ action: "period.manage", reason: "resource" }),
        })
      );
    if (period.tenantId !== tenant._id) {
      return yield* new AccessDenied({
        action: "period.manage",
        reason: "resource",
      });
    }
    if (period.status !== "archived") {
      return periodView(period);
    }
    const unit = yield* reader
      .table("tenantUnits")
      .get(period.unitId)
      .pipe(Effect.orDie);
    if (unit.status === "archived") {
      return yield* new AccessDenied({
        action: "period.manage",
        reason: "condition",
      });
    }
    yield* reactivatePeriod(period);
    yield* periodAuthority.record(personActor(person), period, {
      type: "period.restored",
    });
    const status: typeof PeriodStatus.Type = "active";
    return periodView(Struct.assign(period, { status }));
  })
);
