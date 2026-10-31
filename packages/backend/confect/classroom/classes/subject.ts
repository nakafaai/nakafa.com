import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import {
  classNameKey,
  classNameOf,
  classSubjectKey,
  classView,
} from "@repo/backend/confect/classroom/class";
import spec from "@repo/backend/confect/classroom/classes.spec";
import {
  ClassNameTaken,
  ClassSubjectNotAllowed,
  ClassSubjectTaken,
} from "@repo/backend/confect/classroom/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect, Option, Struct } from "effect";

/**
 * Corrects the subject of a class. The homeroom class of a cohort has none to
 * correct. Another active class of the cohort keeps its subject. A name that still
 * reads as the old subject and the cohort follows the subject, and a name someone
 * chose stays. The address stays, so every link to the class keeps working, and
 * the class keeps its students, teachers and tasks.
 */
export const changeSubject = FunctionImpl.make(
  databaseSchema,
  spec,
  "changeSubject",
  Effect.fn("classroom.classes.changeSubject")(function* ({ subject }) {
    const { person } = yield* Member;
    const row = yield* Class;
    if (row.subject === undefined) {
      return yield* new ClassSubjectNotAllowed();
    }
    if (row.subject === subject) {
      return classView(row);
    }
    const reader = yield* DatabaseReader;
    const cohort = yield* reader
      .table("tenantCohorts")
      .get(row.cohortId)
      .pipe(Effect.orDie);
    const subjectKey = classSubjectKey(subject);
    const sameSubject = yield* reader
      .table("classes")
      .index("by_cohortId_and_status_and_subjectKey", (query) =>
        query
          .eq("cohortId", row.cohortId)
          .eq("status", "active")
          .eq("subjectKey", subjectKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.exists(sameSubject, (other) => other._id !== row._id)) {
      return yield* new ClassSubjectTaken();
    }
    const followsSubject = row.name === classNameOf(cohort.name, row.subject);
    const name = followsSubject ? classNameOf(cohort.name, subject) : row.name;
    const nameKey = classNameKey(name);
    const sameName = yield* reader
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
    const changed = Struct.assign(row, {
      name,
      nameKey,
      subject,
      subjectKey,
      updatedAt: yield* Clock.currentTimeMillis,
    });
    yield* (yield* DatabaseWriter)
      .table("classes")
      .replace(row._id, Struct.omit(changed, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      type: "class.renamed",
    });
    return classView(changed);
  })
);
