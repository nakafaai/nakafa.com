import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { noticeGradeReleased } from "@repo/backend/confect/notifications/grades";
import { Grade } from "@repo/backend/confect/records/access";
import { gradeAuthority } from "@repo/backend/confect/records/authority";
import { gradeView } from "@repo/backend/confect/records/grade";
import spec from "@repo/backend/confect/records/grades.spec";
import { schemeOf } from "@repo/backend/confect/records/version";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect, Struct } from "effect";

/**
 * Corrects a released grade (ADR 0033): the new value stands under the scheme the grade was judged
 * by, its own `grade.corrected` entry keeps the first release on record, and the student and the
 * guardians are told again, in one transaction. A draft takes its value through an entry, so here it
 * answers as it stands, and so does the value the grade already holds.
 */
export const correct = FunctionImpl.make(
  databaseSchema,
  spec,
  "correct",
  Effect.fn("records.grades.correct")(function* ({ value }) {
    const { person: actor } = yield* Member;
    const row = yield* Grade;
    const scheme = yield* schemeOf(row.schemeId);
    if (row.state !== "released" || row.value === value) {
      return gradeView(row, scheme);
    }
    const corrected = Struct.assign(row, {
      updatedAt: yield* Clock.currentTimeMillis,
      value,
    });
    yield* (yield* DatabaseWriter)
      .table("classGrades")
      .replace(row._id, Struct.omit(corrected, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* gradeAuthority.record(personActor(actor), row, {
      classId: row.classId,
      periodId: row.periodId,
      personId: row.personId,
      type: "grade.corrected",
    });
    yield* noticeGradeReleased(corrected);
    return gradeView(corrected, scheme);
  })
);
