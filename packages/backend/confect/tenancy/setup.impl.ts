import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { isLive } from "@repo/backend/confect/guardians/link";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import spec from "@repo/backend/confect/tenancy/setup.spec";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** The newest parent links read for a live one: a school past this many has finished its setup. */
const LINK_SCAN = 20;

/**
 * Which steps of the setup the school's data shows as done: a period running in a unit, an
 * active cohort in one of them, a student, a student placed in such a cohort, an active classroom
 * of one, a teacher who holds the role or an invite still open, a live parent link, and an exam.
 * An archived cohort or class and an ended link count for nothing. Every read is bounded, however
 * large the school grows: a step stops at its first row, and the cohorts stop at their limit.
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
    const cohorts = Arr.filter(
      Arr.flatten(
        yield* Effect.forEach(periods, (period) =>
          reader
            .table("tenantCohorts")
            .index("by_periodId_and_nameKey", (query) =>
              query.eq("periodId", period._id)
            )
            .take(COHORT_LIMIT)
            .pipe(Effect.orDie)
        )
      ),
      (cohort) => cohort.status === "active"
    );
    const placed = yield* Effect.findFirst(cohorts, (cohort) =>
      reader
        .table("tenantCohortMembers")
        .index("by_cohortId_and_personId", (query) =>
          query.eq("cohortId", cohort._id)
        )
        .first()
        .pipe(Effect.map(Option.isSome), Effect.orDie)
    );
    const classroom = yield* Effect.findFirst(cohorts, (cohort) =>
      reader
        .table("classes")
        .index("by_cohortId_and_status_and_nameKey", (query) =>
          query.eq("cohortId", cohort._id).eq("status", "active")
        )
        .first()
        .pipe(Effect.map(Option.isSome), Effect.orDie)
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
    const links = yield* reader
      .table("guardianLinks")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id), "desc")
      .take(LINK_SCAN)
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    return {
      classroom: Option.isSome(classroom),
      cohort: Arr.isArrayNonEmpty(cohorts),
      exam: Option.isSome(exam),
      parent: Arr.some(links, (link) => isLive(link, now)),
      period: Arr.isArrayNonEmpty(periods),
      placed: Option.isSome(placed),
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
