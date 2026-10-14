import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
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
import { CLASS_LIMIT } from "@repo/backend/confect/classroom/class";
import {
  PersonClassLimit,
  PersonNotTeacher,
} from "@repo/backend/confect/classroom/errors";
import {
  teacherAssignment,
  teacherOf,
  teachingIn,
} from "@repo/backend/confect/classroom/teacher";
import spec from "@repo/backend/confect/classroom/teachers.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** One subject teacher as the class's list shows them. */
const view = (person: TenantPeopleDoc) => ({
  id: person._id,
  name: person.name,
});

/**
 * Assigns a Person to teach the class. The Person must hold a teacher grant over
 * the class's unit, and may teach at most CLASS_LIMIT classes of the period. A
 * Person already teaching the class is answered as it stands, with nothing
 * written.
 */
const assign = FunctionImpl.make(
  databaseSchema,
  spec,
  "assign",
  Effect.fn("classroom.teachers.assign")(function* ({ personId }) {
    const { person: actor } = yield* Member;
    const row = yield* Class;
    const teacher = yield* personAuthority.authorize("person.manage", personId);
    if (Option.isSome(yield* teacherAssignment(row._id, teacher._id))) {
      return view(teacher);
    }
    if (!(yield* teacherOf(teacher._id, row.unitId))) {
      return yield* new PersonNotTeacher();
    }
    const teaching = yield* teachingIn(teacher._id, row.periodId);
    if (teaching.length >= CLASS_LIMIT) {
      return yield* new PersonClassLimit();
    }
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("classTeachers")
      .insert({
        classId: row._id,
        createdAt: now,
        periodId: row.periodId,
        personId: teacher._id,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(actor), row, {
      teacher: teacher._id,
      type: "class.teacherAssigned",
    });
    return view(teacher);
  })
);

/**
 * Ends one Person's teaching of the class. The assignment is found inside the
 * class only, so an ID of another school finds nothing. A Person who does not
 * teach the class is answered as it stands, with nothing written.
 */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("classroom.teachers.remove")(function* ({ personId }) {
    const { person: actor } = yield* Member;
    const row = yield* Class;
    const assignment = yield* teacherAssignment(row._id, personId);
    if (Option.isSome(assignment)) {
      yield* (yield* DatabaseWriter)
        .table("classTeachers")
        .delete(assignment.value._id)
        .pipe(Effect.orDie);
      yield* classAuthority.record(personActor(actor), row, {
        teacher: personId,
        type: "class.teacherRemoved",
      });
    }
    return { id: personId };
  })
);

/** One page of a class's subject teachers, each Person read once, concurrently. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.teachers.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const assigned = yield* reader
      .table("classTeachers")
      .index("by_classId_and_personId", (query) => query.eq("classId", row._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const teachers = yield* Effect.forEach(
      assigned.page,
      (assignment) =>
        reader
          .table("tenantPeople")
          .get(assignment.personId)
          .pipe(Effect.orDie),
      { concurrency: "unbounded" }
    );
    return Struct.assign(assigned, { page: Arr.map(teachers, view) });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(assign),
  Layer.provide(remove),
  Layer.provide(list),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
