import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import spec from "@repo/backend/confect/tenancy/units.spec";
import { Effect, Struct } from "effect";

/**
 * Sets the name and the level of one school, which its creation chose. The school's Admin may change them
 * (`tenant.manage`) and the school must allow its changes (`unit.manage`). Each value that changes is recorded on
 * its own, and values already stored write and record nothing.
 */
export const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("tenancy.units.edit")(function* ({ level, name, unitId }) {
    const { person } = yield* Member;
    const unit = yield* unitAuthority.authorize("unit.manage", unitId);
    if (unit.level === level && unit.name === name) {
      return { level, name };
    }
    yield* (yield* DatabaseWriter)
      .table("tenantUnits")
      .replace(
        unit._id,
        Struct.assign(Struct.omit(unit, ["_creationTime", "_id"]), {
          level,
          name,
        })
      )
      .pipe(Effect.orDie);
    if (unit.name !== name) {
      yield* unitAuthority.record(personActor(person), unit, {
        name,
        type: "unit.name.set",
      });
    }
    if (unit.level !== level) {
      yield* unitAuthority.record(personActor(person), unit, {
        level,
        type: "unit.level.set",
      });
    }
    return { level, name };
  })
);
