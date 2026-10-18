import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import {
  classMemberOf,
  placeClass,
  subjectTeacherOf,
} from "@repo/backend/confect/classroom/authority";
import { Grade, GradeAccess } from "@repo/backend/confect/records/access";
import { gradeKind } from "@repo/backend/confect/records/kinds";
import { Effect } from "effect";

/** Reads the class a grade names; a grade always names one, so a missing one is a defect. */
const readClass = Effect.fnUntraced(function* (
  classId: GenericId.GenericId<"classes">
) {
  return yield* (yield* DatabaseReader)
    .table("classes")
    .get(classId)
    .pipe(Effect.orDie);
});

/**
 * A grade sits where its class sits. `classMember` holds only for the student of
 * the grade, and only once it is released and the student is placed in the class's
 * cohort: a classmate's grade and a draft stay closed to a student. `subjectTeacher`
 * holds for the teachers of the class, drafts included.
 */
export const gradeAuthority = Authority.make(
  gradeKind,
  Authority.load(gradeKind),
  {
    place: (row) => readClass(row.classId).pipe(Effect.flatMap(placeClass)),
    relations: {
      classMember: (row, member) =>
        row.personId === member.person._id && row.state === "released"
          ? readClass(row.classId).pipe(
              Effect.flatMap((cls) => classMemberOf(cls, member))
            )
          : Effect.succeed(false),
      subjectTeacher: (row, member) =>
        readClass(row.classId).pipe(
          Effect.flatMap((cls) => subjectTeacherOf(cls, member))
        ),
    },
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks a grade action on the grade its access spec names, and provides the loaded grade to the function. */
export const gradeAccess = MiddlewareImpl.make(
  databaseSchema,
  GradeAccess,
  gradeAuthority.middleware(Grade)
);
