import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Grade } from "@repo/backend/confect/records/access";
import { gradeAuthority } from "@repo/backend/confect/records/authority";
import {
  type GradeState,
  gradeView,
} from "@repo/backend/confect/records/grade";
import spec from "@repo/backend/confect/records/grades.spec";
import { schemeOf } from "@repo/backend/confect/records/version";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect, Struct } from "effect";

/**
 * Releases a draft grade, which makes it visible to its student. The release and
 * its `grade.released` entry are written in one transaction. A grade that is
 * already released answers as it stands and journals nothing.
 */
export const release = FunctionImpl.make(
  databaseSchema,
  spec,
  "release",
  Effect.fn("records.grades.release")(function* () {
    const { person: actor } = yield* Member;
    const row = yield* Grade;
    const scheme = yield* schemeOf(row.schemeId);
    if (row.state === "released") {
      return gradeView(row, scheme);
    }
    const now = yield* Clock.currentTimeMillis;
    const state: typeof GradeState.Type = "released";
    const released = Struct.assign(row, {
      releasedAt: now,
      state,
      updatedAt: now,
    });
    yield* (yield* DatabaseWriter)
      .table("classGrades")
      .replace(row._id, Struct.omit(released, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* gradeAuthority.record(personActor(actor), row, {
      classId: row.classId,
      periodId: row.periodId,
      personId: row.personId,
      state,
      type: "grade.released",
    });
    return gradeView(released, scheme);
  })
);
