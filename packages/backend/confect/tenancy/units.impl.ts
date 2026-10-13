import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import type { UnitStatus } from "@repo/backend/confect/tenancy/schema";
import spec from "@repo/backend/confect/tenancy/units.spec";
import { Effect, Layer, Struct } from "effect";

/**
 * Sets the time zone and the content language of one school. The school must
 * be in the member's tenant and not archived (`unit.manage`, ADR 0012), and an
 * Admin may change a school they hold the role for. A value that is already
 * stored writes and records nothing.
 */
const setLocale = FunctionImpl.make(
  databaseSchema,
  spec,
  "setLocale",
  Effect.fn("tenancy.units.setLocale")(function* ({
    contentLanguage,
    timeZone,
    unitId,
  }) {
    const { person } = yield* Member;
    const unit = yield* unitAuthority.authorize("unit.manage", unitId);
    if (
      unit.contentLanguage !== contentLanguage ||
      unit.timeZone !== timeZone
    ) {
      yield* (yield* DatabaseWriter)
        .table("tenantUnits")
        .replace(
          unit._id,
          Struct.assign(Struct.omit(unit, ["_creationTime", "_id"]), {
            contentLanguage,
            timeZone,
          })
        )
        .pipe(Effect.orDie);
      yield* unitAuthority.record(personActor(person), unit, {
        contentLanguage,
        timeZone,
        type: "unit.locale.set",
      });
    }
    return { contentLanguage, timeZone };
  })
);

/**
 * Archives or restores one school. The right to do it is `tenant.manage`,
 * which the function's middleware decided on the tenant, because an archived
 * school refuses every write and so cannot decide its own restoring. Loading
 * the school through `unit.view`, which every member holds, only proves that it
 * belongs to the member's tenant: another tenant's school and a missing one
 * are denied alike. A school already in the status is left as it is.
 */
const changeStatus = Effect.fn("tenancy.units.status")(function* (
  unitId: GenericId.GenericId<"tenantUnits">,
  status: typeof UnitStatus.Type
) {
  const { person } = yield* Member;
  const unit = yield* unitAuthority.authorize("unit.view", unitId);
  if (unit.status !== status) {
    yield* (yield* DatabaseWriter)
      .table("tenantUnits")
      .replace(
        unit._id,
        Struct.assign(Struct.omit(unit, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* unitAuthority.record(
      personActor(person),
      unit,
      status === "archived"
        ? { type: "unit.archived" }
        : { type: "unit.unarchived" }
    );
  }
  return status;
});

const archive = FunctionImpl.make(
  databaseSchema,
  spec,
  "archive",
  Effect.fn("tenancy.units.archive")(function* ({ unitId }) {
    return yield* changeStatus(unitId, "archived");
  })
);

const unarchive = FunctionImpl.make(
  databaseSchema,
  spec,
  "unarchive",
  Effect.fn("tenancy.units.unarchive")(function* ({ unitId }) {
    return yield* changeStatus(unitId, "active");
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setLocale),
  Layer.provide(archive),
  Layer.provide(unarchive),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
