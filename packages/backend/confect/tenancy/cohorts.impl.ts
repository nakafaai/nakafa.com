import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantCohortsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Cohort, Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  cohortAccess,
  cohortAuthority,
  periodAccess,
} from "@repo/backend/confect/tenancy/authority";
import {
  COHORT_LIMIT,
  type CohortStatus,
  cohortNameKey,
} from "@repo/backend/confect/tenancy/cohort";
import spec from "@repo/backend/confect/tenancy/cohorts.spec";
import {
  CohortLimit,
  CohortNameTaken,
} from "@repo/backend/confect/tenancy/errors";
import { cohortMembers } from "@repo/backend/confect/tenancy/members";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

/** One cohort as the wire shows it. */
const view = (cohort: TenantCohortsDoc) =>
  Struct.renameKeys(Struct.pick(cohort, ["_id", "grade", "name", "status"]), {
    _id: "id",
  });

/** The cohorts of one period by grade, then name, at most COHORT_LIMIT of them. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.cohorts.list")(function* () {
    const period = yield* Period;
    const cohorts = yield* (yield* DatabaseReader)
      .table("tenantCohorts")
      .index("by_periodId_and_grade_and_nameKey", (query) =>
        query.eq("periodId", period._id)
      )
      .take(COHORT_LIMIT)
      .pipe(Effect.orDie);
    return Arr.map(cohorts, view);
  })
);

/** The Persons placed in one cohort, a page at a time, with the name each list row shows. */
const members = FunctionImpl.make(
  databaseSchema,
  spec,
  "members",
  Effect.fn("tenancy.cohorts.members")(function* ({ paginationOpts }) {
    const cohort = yield* Cohort;
    const placed = yield* cohortMembers(cohort._id, paginationOpts);
    return Struct.assign(placed, {
      page: Arr.map(placed.page, (person) => ({
        id: person._id,
        name: person.name,
      })),
    });
  })
);

/**
 * Creates an active cohort in a period. Its name is unique within the period
 * without regard to case, and a period holds at most COHORT_LIMIT cohorts.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("tenancy.cohorts.create")(function* ({ grade, name }) {
    const { person } = yield* Member;
    const period = yield* Period;
    const reader = yield* DatabaseReader;
    const nameKey = cohortNameKey(name);
    const sameName = yield* reader
      .table("tenantCohorts")
      .index("by_periodId_and_nameKey", (query) =>
        query.eq("periodId", period._id).eq("nameKey", nameKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sameName)) {
      return yield* new CohortNameTaken();
    }
    const cohorts = yield* reader
      .table("tenantCohorts")
      .index("by_periodId_and_grade_and_nameKey", (query) =>
        query.eq("periodId", period._id)
      )
      .take(COHORT_LIMIT)
      .pipe(Effect.orDie);
    if (cohorts.length >= COHORT_LIMIT) {
      return yield* new CohortLimit();
    }
    const cohortId = yield* (yield* DatabaseWriter)
      .table("tenantCohorts")
      .insert({
        grade,
        name,
        nameKey,
        periodId: period._id,
        status: "active",
        tenantId: period.tenantId,
        unitId: period.unitId,
      })
      .pipe(Effect.orDie);
    const cohort = yield* reader
      .table("tenantCohorts")
      .get(cohortId)
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(personActor(person), cohort, {
      type: "cohort.created",
    });
    return view(cohort);
  })
);

/**
 * Renames one cohort. The name stays unique within its period, and a name that
 * only differs in case from the cohort's own is not taken by the cohort itself.
 */
const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("tenancy.cohorts.rename")(function* ({ name }) {
    const { person } = yield* Member;
    const cohort = yield* Cohort;
    if (cohort.name === name) {
      return view(cohort);
    }
    const nameKey = cohortNameKey(name);
    const sameName = yield* (yield* DatabaseReader)
      .table("tenantCohorts")
      .index("by_periodId_and_nameKey", (query) =>
        query.eq("periodId", cohort.periodId).eq("nameKey", nameKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.exists(sameName, (other) => other._id !== cohort._id)) {
      return yield* new CohortNameTaken();
    }
    yield* (yield* DatabaseWriter)
      .table("tenantCohorts")
      .replace(
        cohort._id,
        Struct.assign(Struct.omit(cohort, ["_creationTime", "_id"]), {
          name,
          nameKey,
        })
      )
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(personActor(person), cohort, {
      type: "cohort.renamed",
    });
    return view(Struct.assign(cohort, { name, nameKey }));
  })
);

/** Archives one active cohort, which then stays readable and refuses writes. */
const archive = FunctionImpl.make(
  databaseSchema,
  spec,
  "archive",
  Effect.fn("tenancy.cohorts.archive")(function* () {
    const { person } = yield* Member;
    const cohort = yield* Cohort;
    const status: typeof CohortStatus.Type = "archived";
    yield* (yield* DatabaseWriter)
      .table("tenantCohorts")
      .replace(
        cohort._id,
        Struct.assign(Struct.omit(cohort, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(personActor(person), cohort, {
      type: "cohort.archived",
    });
    return view(Struct.assign(cohort, { status }));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(members),
  Layer.provide(create),
  Layer.provide(rename),
  Layer.provide(archive),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(periodAccess),
  Layer.provide(cohortAccess),
  GroupImpl.finalize
);
