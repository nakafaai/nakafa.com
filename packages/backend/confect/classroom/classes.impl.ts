import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  classAccess,
  classAuthority,
} from "@repo/backend/confect/classroom/authority";
import {
  type ClassStatus,
  classNameKey,
  classView,
} from "@repo/backend/confect/classroom/class";
import { create } from "@repo/backend/confect/classroom/classes/create";
import { mine } from "@repo/backend/confect/classroom/classes/mine";
import spec from "@repo/backend/confect/classroom/classes.spec";
import { ClassNameTaken } from "@repo/backend/confect/classroom/errors";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  cohortAccess,
  periodAccess,
} from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/**
 * Renames one class. Its address stays, and its name stays unique among the
 * active classes of its cohort. A name that only differs in case from the class's
 * own name is not taken by the class itself.
 */
const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("classroom.classes.rename")(function* ({ name }) {
    const { person } = yield* Member;
    const row = yield* Class;
    if (row.name === name) {
      return classView(row);
    }
    const nameKey = classNameKey(name);
    const sameName = yield* (yield* DatabaseReader)
      .table("classes")
      .index("by_cohortId_and_status_and_nameKey", (query) =>
        query
          .eq("cohortId", row.cohortId)
          .eq("status", "active")
          .eq("nameKey", nameKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.exists(sameName, (other) => other._id !== row._id)) {
      return yield* new ClassNameTaken();
    }
    const now = yield* Clock.currentTimeMillis;
    const renamed = Struct.assign(row, { name, nameKey, updatedAt: now });
    yield* (yield* DatabaseWriter)
      .table("classes")
      .replace(row._id, Struct.omit(renamed, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      type: "class.renamed",
    });
    return classView(renamed);
  })
);

/** Archives one active class, which then stays readable and refuses writes. */
const archive = FunctionImpl.make(
  databaseSchema,
  spec,
  "archive",
  Effect.fn("classroom.classes.archive")(function* () {
    const { person } = yield* Member;
    const row = yield* Class;
    const status: typeof ClassStatus.Type = "archived";
    const now = yield* Clock.currentTimeMillis;
    const archived = Struct.assign(row, { status, updatedAt: now });
    yield* (yield* DatabaseWriter)
      .table("classes")
      .replace(row._id, Struct.omit(archived, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      type: "class.archived",
    });
    return classView(archived);
  })
);

/** One class, read by a leader of the school or by a member of the class. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("classroom.classes.get")(function* () {
    return classView(yield* Class);
  })
);

/**
 * One page of a period's classes in subject order, then name order, so the
 * classes of one subject sit together.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.classes.list")(function* ({ paginationOpts }) {
    const period = yield* Period;
    const page = yield* (yield* DatabaseReader)
      .table("classes")
      .index("by_periodId_and_subjectKey_and_nameKey", (query) =>
        query.eq("periodId", period._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, classView) });
  })
);

/** The classes of a school: create, rename, archive, read, list, and the classes a Person teaches or attends. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(create),
  Layer.provide(rename),
  Layer.provide(archive),
  Layer.provide(get),
  Layer.provide(list),
  Layer.provide(mine),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(cohortAccess),
  Layer.provide(periodAccess),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
