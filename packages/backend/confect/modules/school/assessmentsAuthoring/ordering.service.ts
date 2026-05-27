import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { requireAssessment } from "@repo/backend/confect/modules/school/assessments.shared";
import { requirePermission } from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Clock, Effect } from "effect";

/** Reorders an assessment within its school or class list. */
export const reorderAssessment = Effect.fn("assessments.reorderAssessment")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly direction: "down" | "up";
    readonly schoolId: Id<"schools">;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const assessment = yield* requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
      classId: assessment.classId,
      schoolId: assessment.schoolId,
      userId: user.appUser._id,
    });

    const adjacentAssessment = assessment.classId
      ? yield* findAdjacentClassAssessment(ctx, assessment, args.direction)
      : yield* findAdjacentSchoolAssessment(ctx, assessment, args.direction);

    if (!adjacentAssessment) {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;

    yield* Effect.promise(() =>
      ctx.db.patch(assessment._id, {
        order: adjacentAssessment.order,
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch(adjacentAssessment._id, {
        order: assessment.order,
        updatedAt: now,
      })
    );

    return null;
  }
);

/** Finds the adjacent class assessment for reordering. */
const findAdjacentClassAssessment = Effect.fn(
  "assessments.findAdjacentClassAssessment"
)(function* (
  ctx: ConvexMutationCtx,
  assessment: Doc<"schoolAssessments">,
  direction: "down" | "up"
) {
  if (!assessment.classId) {
    return null;
  }

  if (direction === "up") {
    return yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_classId_and_order", (query) =>
          query
            .eq("schoolId", assessment.schoolId)
            .eq("classId", assessment.classId)
            .lt("order", assessment.order)
        )
        .order("desc")
        .first()
    );
  }

  return yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_classId_and_order", (query) =>
        query
          .eq("schoolId", assessment.schoolId)
          .eq("classId", assessment.classId)
          .gt("order", assessment.order)
      )
      .order("asc")
      .first()
  );
});

/** Finds the adjacent school assessment for reordering. */
const findAdjacentSchoolAssessment = Effect.fn(
  "assessments.findAdjacentSchoolAssessment"
)(function* (
  ctx: ConvexMutationCtx,
  assessment: Doc<"schoolAssessments">,
  direction: "down" | "up"
) {
  if (direction === "up") {
    return yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_order", (query) =>
          query
            .eq("schoolId", assessment.schoolId)
            .lt("order", assessment.order)
        )
        .order("desc")
        .first()
    );
  }

  return yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_order", (query) =>
        query.eq("schoolId", assessment.schoolId).gt("order", assessment.order)
      )
      .order("asc")
      .first()
  );
});
