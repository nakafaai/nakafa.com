import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import { NpsnInvalid, NpsnTaken } from "@repo/backend/confect/tenancy/errors";
import {
  Npsn,
  UNIT_LIMIT,
  type UnitStatus,
} from "@repo/backend/confect/tenancy/schema";
import spec from "@repo/backend/confect/tenancy/units.spec";
import { Array as Arr, Effect, Layer, Schema, Struct } from "effect";

/**
 * Lists every unit of the member's school with its national school number. A
 * school holds at most `UNIT_LIMIT` units, so one indexed read holds them all.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.units.list")(function* () {
    const { tenant } = yield* Member;
    const units = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    return Arr.map(units, (unit) => ({
      contentLanguage: unit.contentLanguage,
      id: unit._id,
      level: unit.level,
      name: unit.name,
      npsn: unit.npsn ?? null,
      status: unit.status,
      timeZone: unit.timeZone,
    }));
  })
);

/**
 * Sets the national school number (NPSN) of one unit. The number is eight
 * digits, and no other unit of the school holds it. The school's Admin may set
 * it (`tenant.manage`) and the unit must allow its changes (`unit.manage`). A
 * value that is already stored writes and records nothing.
 */
const setNpsn = FunctionImpl.make(
  databaseSchema,
  spec,
  "setNpsn",
  Effect.fn("tenancy.units.setNpsn")(function* ({ npsn, unitId }) {
    const { person, tenant } = yield* Member;
    if (!Schema.is(Npsn)(npsn)) {
      return yield* new NpsnInvalid();
    }
    const unit = yield* unitAuthority.authorize("unit.manage", unitId);
    if (unit.npsn === npsn) {
      return npsn;
    }
    const units = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    if (
      Arr.some(units, (other) => other._id !== unit._id && other.npsn === npsn)
    ) {
      return yield* new NpsnTaken();
    }
    yield* (yield* DatabaseWriter)
      .table("tenantUnits")
      .replace(
        unit._id,
        Struct.assign(Struct.omit(unit, ["_creationTime", "_id"]), { npsn })
      )
      .pipe(Effect.orDie);
    yield* unitAuthority.record(personActor(person), unit, {
      npsn,
      type: "unit.npsn.set",
    });
    return npsn;
  })
);

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
  Layer.provide(list),
  Layer.provide(setNpsn),
  Layer.provide(setLocale),
  Layer.provide(archive),
  Layer.provide(unarchive),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
