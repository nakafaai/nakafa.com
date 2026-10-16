import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantAssignmentsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import spec from "@repo/backend/confect/tenancy/assignments.spec";
import {
  cohortAccess,
  cohortAuthority,
  homeroomOf,
  homeroomOfPerson,
  personAuthority,
  teacherOf,
} from "@repo/backend/confect/tenancy/authority";
import {
  CohortHasHomeroom,
  PersonNotTeacher,
  TeacherHasHomeroom,
} from "@repo/backend/confect/tenancy/errors";
import { Effect, Layer, Option, Struct } from "effect";

/** One assignment as the wire shows it. */
const view = (assignment: TenantAssignmentsDoc) =>
  Struct.renameKeys(
    Struct.pick(assignment, ["_id", "cohortId", "kind", "personId"]),
    { _id: "id" }
  );

/**
 * Makes an active teacher of the unit the homeroom teacher of a cohort. A cohort
 * holds one homeroom teacher, unless that teacher was removed, and a teacher is the
 * homeroom teacher of one cohort per period, so each check is one indexed read.
 */
const assign = FunctionImpl.make(
  databaseSchema,
  spec,
  "assign",
  Effect.fn("tenancy.assignments.assign")(function* ({ personId }) {
    const { person: actor } = yield* Member;
    const cohort = yield* Cohort;
    const person = yield* personAuthority.authorize("person.view", personId);
    if (
      person.status !== "active" ||
      !(yield* teacherOf(person._id, cohort.unitId))
    ) {
      return yield* new PersonNotTeacher();
    }
    if (Option.isSome(yield* homeroomOfPerson(cohort.periodId, person._id))) {
      return yield* new TeacherHasHomeroom();
    }
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const holder = yield* homeroomOf(cohort._id);
    if (Option.isSome(holder)) {
      // Removing a Person keeps their homeroom row, so a removed teacher holds no slot
      // and this assignment replaces their row. A teacher who still works keeps the slot.
      const teacher = yield* reader
        .table("tenantPeople")
        .get(holder.value.personId)
        .pipe(Effect.orDie);
      if (teacher.status !== "removed") {
        return yield* new CohortHasHomeroom();
      }
      yield* writer
        .table("tenantAssignments")
        .delete(holder.value._id)
        .pipe(Effect.orDie);
      yield* cohortAuthority.record(personActor(actor), cohort, {
        assignment: "homeroom",
        person: holder.value.personId,
        type: "assignment.removed",
      });
    }
    const assignmentId = yield* writer
      .table("tenantAssignments")
      .insert({
        cohortId: cohort._id,
        kind: "homeroom",
        periodId: cohort.periodId,
        personId: person._id,
        tenantId: cohort.tenantId,
      })
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(personActor(actor), cohort, {
      assignment: "homeroom",
      person: person._id,
      type: "assignment.created",
    });
    const assignment = yield* reader
      .table("tenantAssignments")
      .get(assignmentId)
      .pipe(Effect.orDie);
    return view(assignment);
  })
);

/** Removes the homeroom teacher of a cohort. A cohort without one stays as it is and answers `null`. */
const unassign = FunctionImpl.make(
  databaseSchema,
  spec,
  "unassign",
  Effect.fn("tenancy.assignments.unassign")(function* () {
    const { person: actor } = yield* Member;
    const cohort = yield* Cohort;
    const current = yield* homeroomOf(cohort._id);
    if (Option.isNone(current)) {
      return null;
    }
    yield* (yield* DatabaseWriter)
      .table("tenantAssignments")
      .delete(current.value._id)
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(personActor(actor), cohort, {
      assignment: "homeroom",
      person: current.value.personId,
      type: "assignment.removed",
    });
    return view(current.value);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(assign),
  Layer.provide(unassign),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(cohortAccess),
  GroupImpl.finalize
);
