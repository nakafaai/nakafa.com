import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantAssignmentsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import spec from "@repo/backend/confect/tenancy/assignments.spec";
import {
  activeHomeroomOf,
  cohortAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  checkHomeroom,
  insertHomeroom,
  removeHomeroom,
} from "@repo/backend/confect/tenancy/write/assignment";
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
    const replacing = yield* checkHomeroom(cohort, person);
    const assignmentId = yield* insertHomeroom(
      personActor(actor),
      cohort,
      person._id,
      replacing
    );
    const assignment = yield* (yield* DatabaseReader)
      .table("tenantAssignments")
      .get(assignmentId)
      .pipe(Effect.orDie);
    return view(assignment);
  })
);

/**
 * Removes the homeroom teacher of a cohort. A cohort without one stays as it is and
 * answers `null`, and so does a cohort whose teacher was removed: that teacher holds
 * no slot, and their row stays until an assignment replaces it.
 */
const unassign = FunctionImpl.make(
  databaseSchema,
  spec,
  "unassign",
  Effect.fn("tenancy.assignments.unassign")(function* () {
    const { person: actor } = yield* Member;
    const cohort = yield* Cohort;
    const current = yield* activeHomeroomOf(cohort._id);
    if (Option.isNone(current)) {
      return null;
    }
    yield* removeHomeroom(personActor(actor), cohort, current.value);
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
