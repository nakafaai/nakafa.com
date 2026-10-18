import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  GradeNotPlaced,
  GradeReleased,
} from "@repo/backend/confect/records/errors";
import {
  type gradeValidator,
  gradeView,
} from "@repo/backend/confect/records/grade";
import spec from "@repo/backend/confect/records/grades.spec";
import { schemeInForce } from "@repo/backend/confect/records/version";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import { Clock, Effect, Option } from "effect";

/**
 * Writes the draft of one student's final grade in the class, or replaces the
 * draft that stands. The student must be placed in the class's cohort in its
 * period, and a released grade is refused, because no entry changes it. The draft
 * is judged by the scheme in force at this entry, and it names that version. A
 * draft is not journaled, because only a release is (ADR 0016).
 */
export const enter = FunctionImpl.make(
  databaseSchema,
  spec,
  "enter",
  Effect.fn("records.grades.enter")(function* ({ personId, value }) {
    const row = yield* Class;
    const placement = yield* placementOf(row.periodId, personId);
    if (!Option.exists(placement, (found) => found.cohortId === row.cohortId)) {
      return yield* new GradeNotPlaced();
    }
    const existing = yield* (yield* DatabaseReader)
      .table("classGrades")
      .get("by_classId_and_personId", row._id, personId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
        Effect.orDie
      );
    if (Option.exists(existing, (grade) => grade.state === "released")) {
      return yield* new GradeReleased();
    }
    const { id: schemeId, scheme } = yield* schemeInForce(row.tenantId);
    const now = yield* Clock.currentTimeMillis;
    const draft: typeof gradeValidator.Type = {
      classId: row._id,
      createdAt: Option.match(existing, {
        onNone: () => now,
        onSome: (grade) => grade.createdAt,
      }),
      periodId: row.periodId,
      personId,
      state: "draft",
      tenantId: row.tenantId,
      updatedAt: now,
      value,
      ...(schemeId === undefined ? {} : { schemeId }),
    };
    const writer = yield* DatabaseWriter;
    const gradeId = yield* Option.match(existing, {
      onNone: () => writer.table("classGrades").insert(draft),
      onSome: (grade) =>
        writer
          .table("classGrades")
          .replace(grade._id, draft)
          .pipe(Effect.as(grade._id)),
    }).pipe(Effect.orDie);
    return gradeView(
      { _id: gradeId, classId: row._id, personId, state: "draft", value },
      scheme
    );
  })
);
