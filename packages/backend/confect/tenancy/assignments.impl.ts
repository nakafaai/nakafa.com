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
 * holds one homeroom teacher, and a teacher is the homeroom teacher of one cohort
 * per period, so both checks are one indexed read each.
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
    if (Option.isSome(yield* homeroomOf(cohort._id))) {
      return yield* new CohortHasHomeroom();
    }
    if (Option.isSome(yield* homeroomOfPerson(cohort.periodId, person._id))) {
      return yield* new TeacherHasHomeroom();
    }
    const reader = yield* DatabaseReader;
    const assignmentId = yield* (yield* DatabaseWriter)
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
