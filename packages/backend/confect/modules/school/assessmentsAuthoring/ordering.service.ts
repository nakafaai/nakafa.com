import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { requireAssessment } from "@repo/backend/confect/modules/school/assessments.shared";
import { requirePermission } from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Effect, Option } from "effect";

/** Reorders an assessment within its school or class list. */
export const reorderAssessment = Effect.fn("assessments.reorderAssessment")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly direction: "down" | "up";
    readonly schoolId: Id<"schools">;
  }) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();
    const assessment = yield* requireAssessment(
      args.schoolId,
      args.assessmentId
    );

    yield* requirePermission(PERMISSIONS.ASSESSMENT_UPDATE, {
      classId: assessment.classId,
      schoolId: assessment.schoolId,
      userId: user.appUser._id,
    });

    const adjacentAssessment = assessment.classId
      ? yield* findAdjacentClassAssessment(assessment, args.direction)
      : yield* findAdjacentSchoolAssessment(assessment, args.direction);

    if (!adjacentAssessment) {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;

    yield* writer.table("schoolAssessments").patch(assessment._id, {
      order: adjacentAssessment.order,
      updatedAt: now,
    });
    yield* writer.table("schoolAssessments").patch(adjacentAssessment._id, {
      order: assessment.order,
      updatedAt: now,
    });

    return null;
  }
);

/** Finds the adjacent class assessment for reordering. */
const findAdjacentClassAssessment = Effect.fn(
  "assessments.findAdjacentClassAssessment"
)(function* (assessment: Doc<"schoolAssessments">, direction: "down" | "up") {
  if (!assessment.classId) {
    return null;
  }

  const reader = yield* DatabaseReader;

  if (direction === "up") {
    return yield* reader
      .table("schoolAssessments")
      .index(
        "by_schoolId_and_classId_and_order",
        (query) =>
          query
            .eq("schoolId", assessment.schoolId)
            .eq("classId", assessment.classId)
            .lt("order", assessment.order),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));
  }

  return yield* reader
    .table("schoolAssessments")
    .index("by_schoolId_and_classId_and_order", (query) =>
      query
        .eq("schoolId", assessment.schoolId)
        .eq("classId", assessment.classId)
        .gt("order", assessment.order)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
});

/** Finds the adjacent school assessment for reordering. */
const findAdjacentSchoolAssessment = Effect.fn(
  "assessments.findAdjacentSchoolAssessment"
)(function* (assessment: Doc<"schoolAssessments">, direction: "down" | "up") {
  const reader = yield* DatabaseReader;

  if (direction === "up") {
    return yield* reader
      .table("schoolAssessments")
      .index(
        "by_schoolId_and_order",
        (query) =>
          query
            .eq("schoolId", assessment.schoolId)
            .lt("order", assessment.order),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));
  }

  return yield* reader
    .table("schoolAssessments")
    .index("by_schoolId_and_order", (query) =>
      query.eq("schoolId", assessment.schoolId).gt("order", assessment.order)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
});
