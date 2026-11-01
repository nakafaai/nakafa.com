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
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import spec from "@repo/backend/confect/tenancy/setup.spec";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/**
 * Which steps of the setup the school's data shows as done: a period running in a unit, a
 * cohort in one of them, a student, a classroom, a teacher who holds the role or an invite still
 * open, a parent, and an exam. Each step reads one row, so the read stays bounded however large
 * the school grows.
 */
const state = FunctionImpl.make(
  databaseSchema,
  spec,
  "state",
  Effect.fn("tenancy.setup.state")(function* () {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const units = yield* reader
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    const periods = Arr.getSomes(
      yield* Effect.forEach(units, (unit) =>
        reader
          .table("tenantPeriods")
          .index("by_unitId_and_status", (query) =>
            query.eq("unitId", unit._id).eq("status", "active")
          )
          .first()
          .pipe(Effect.orDie)
      )
    );
    const cohorts = Arr.getSomes(
      yield* Effect.forEach(periods, (period) =>
        reader
          .table("tenantCohorts")
          .index("by_periodId_and_nameKey", (query) =>
            query.eq("periodId", period._id)
          )
          .first()
          .pipe(Effect.orDie)
      )
    );
    const student = yield* reader
      .table("tenantGrants")
      .index("by_tenantId_and_role_key_and_status", (query) =>
        query
          .eq("tenantId", tenant._id)
          .eq("role.key", "student")
          .eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    const exam = yield* reader
      .table("exams")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id))
      .first()
      .pipe(Effect.orDie);
    const classroom = yield* reader
      .table("classes")
      .index("by_tenantId_and_slug", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .first()
      .pipe(Effect.orDie);
    const teacher = yield* reader
      .table("tenantGrants")
      .index("by_tenantId_and_role_key_and_status", (query) =>
        query
          .eq("tenantId", tenant._id)
          .eq("role.key", "teacher")
          .eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    const invite = yield* reader
      .table("tenantInvites")
      .index("by_tenantId_and_state_status", (query) =>
        query.eq("tenantId", tenant._id).eq("state.status", "pending")
      )
      .first()
      .pipe(Effect.orDie);
    const parent = yield* reader
      .table("guardianLinks")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id))
      .first()
      .pipe(Effect.orDie);
    return {
      classroom: Option.isSome(classroom),
      cohort: Arr.isArrayNonEmpty(cohorts),
      exam: Option.isSome(exam),
      parent: Option.isSome(parent),
      period: Arr.isArrayNonEmpty(periods),
      student: Option.isSome(student),
      teacher: Option.isSome(teacher) || Option.isSome(invite),
    };
  })
);

/** Marks the setup finished once, so a second press writes and records nothing. */
const finish = FunctionImpl.make(
  databaseSchema,
  spec,
  "finish",
  Effect.fn("tenancy.setup.finish")(function* () {
    const { person, tenant } = yield* Member;
    if (tenant.setupDoneAt !== undefined) {
      return null;
    }
    yield* (yield* DatabaseWriter)
      .table("tenants")
      .replace(
        tenant._id,
        Struct.assign(Struct.omit(tenant, ["_creationTime", "_id"]), {
          setupDoneAt: yield* Clock.currentTimeMillis,
        })
      )
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      type: "tenant.setup.finished",
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(state),
  Layer.provide(finish),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
