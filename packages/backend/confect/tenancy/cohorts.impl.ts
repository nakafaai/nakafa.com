import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantCohortsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Cohort, Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  activeHomeroomOf,
  cohortAccess,
  cohortAuthority,
  periodAccess,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  COHORT_LIMIT,
  type CohortStatus,
  cohortNameKey,
} from "@repo/backend/confect/tenancy/cohort";
import { restoreCohort } from "@repo/backend/confect/tenancy/cohort.restore";
import spec from "@repo/backend/confect/tenancy/cohorts.spec";
import { CohortNameTaken } from "@repo/backend/confect/tenancy/errors";
import { cohortMembers } from "@repo/backend/confect/tenancy/members";
import {
  checkCohorts,
  insertCohort,
} from "@repo/backend/confect/tenancy/write/cohort";
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

/**
 * The homeroom teacher of one cohort as its readers see them, or null while the cohort has
 * none. A teacher who was removed holds no slot, so the readers find none for them.
 */
const homeroomTeacherOf = Effect.fnUntraced(function* (
  cohortId: TenantCohortsDoc["_id"]
) {
  const assignment = yield* activeHomeroomOf(cohortId);
  if (Option.isNone(assignment)) {
    return null;
  }
  const teacher = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(assignment.value.personId)
    .pipe(Effect.orDie);
  return { id: teacher._id, name: teacher.name };
});

/** One cohort with its period, and the homeroom teacher it has now. */
const detail = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.cohorts.get")(function* () {
    const cohort = yield* Cohort;
    return Struct.assign(view(cohort), {
      homeroom: yield* homeroomTeacherOf(cohort._id),
      periodId: cohort.periodId,
    });
  })
);

/**
 * The active period of one unit, which the unit's new cohorts join, or null while the unit
 * has none open. A unit holds at most one active period, so the lookup is one indexed read.
 */
const activePeriod = FunctionImpl.make(
  databaseSchema,
  spec,
  "activePeriod",
  Effect.fn("tenancy.cohorts.activePeriod")(function* ({ unitId }) {
    yield* unitAuthority.authorize("period.view", unitId);
    const period = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", unitId).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    return Option.match(period, {
      onNone: () => null,
      onSome: (found) => found._id,
    });
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
    yield* checkCohorts(period, [{ grade, name }]);
    return view(
      yield* insertCohort(personActor(person), period, { grade, name })
    );
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

/** Restores one archived cohort to active at the school level; see `restoreCohort`. */
const restore = FunctionImpl.make(
  databaseSchema,
  spec,
  "restore",
  Effect.fn("tenancy.cohorts.restore")(function* ({ cohortId }) {
    const { person, tenant } = yield* Member;
    return view(
      yield* restoreCohort(personActor(person), tenant._id, cohortId)
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(detail),
  Layer.provide(activePeriod),
  Layer.provide(members),
  Layer.provide(create),
  Layer.provide(rename),
  Layer.provide(archive),
  Layer.provide(restore),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(periodAccess),
  Layer.provide(cohortAccess),
  GroupImpl.finalize
);
