import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  listVisibleQuestionBanks,
  loadAuthoredAssessment,
} from "@repo/backend/confect/modules/school/assessments.shared";
import {
  isAdmin,
  loadClass,
  requireClassAccess,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Effect } from "effect";

interface PaginationOpts {
  readonly cursor: string | null;
  readonly endCursor?: string | null;
  readonly id?: number;
  readonly maximumBytesRead?: number;
  readonly maximumRowsRead?: number;
  readonly numItems: number;
}

/** Returns the editable assessment tree for authorized authors. */
export const getAuthoredAssessment = Effect.fn(
  "assessments.getAuthoredAssessment"
)(function* (args: {
  readonly assessmentId: Id<"schoolAssessments">;
  readonly schoolId: Id<"schools">;
}) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const authored = yield* loadAuthoredAssessment(ctx, args.assessmentId);

  if (!authored || authored.assessment.schoolId !== args.schoolId) {
    return null;
  }

  yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
    classId: authored.assessment.classId,
    schoolId: authored.assessment.schoolId,
    userId: user.appUser._id,
  });

  return authored;
});

/** Lists question banks visible to the current school/class scope. */
export const listQuestionBanks = Effect.fn("assessments.listQuestionBanks")(
  function* (args: {
    readonly classId?: Id<"schoolClasses">;
    readonly schoolId: Id<"schools">;
  }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);
    const classData = args.classId ? yield* loadClass(ctx, args.classId) : null;

    if (classData && classData.schoolId !== args.schoolId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "CLASS_NOT_FOUND",
          message: "Class not found in this school.",
        })
      );
    }

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
      classId: classData?._id,
      schoolId: args.schoolId,
      userId: user.appUser._id,
    });

    return yield* listVisibleQuestionBanks(ctx, args.schoolId, classData?._id);
  }
);

/** Lists assessments visible to the current user and scope. */
export const listAssessments = Effect.fn("assessments.listAssessments")(
  function* (args: {
    readonly classId?: Id<"schoolClasses">;
    readonly paginationOpts: PaginationOpts;
    readonly schoolId: Id<"schools">;
  }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);
    const classData = args.classId ? yield* loadClass(ctx, args.classId) : null;

    if (classData && classData.schoolId !== args.schoolId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "CLASS_NOT_FOUND",
          message: "Class not found in this school.",
        })
      );
    }

    if (classData) {
      const { classMembership, schoolMembership } = yield* requireClassAccess(
        ctx,
        classData._id,
        classData.schoolId,
        user.appUser._id
      );
      const canSeeAllStatuses =
        classMembership?.role === "teacher" || isAdmin(schoolMembership);

      if (canSeeAllStatuses) {
        return yield* Effect.promise(() =>
          ctx.db
            .query("schoolAssessments")
            .withIndex("by_schoolId_and_classId_and_order", (query) =>
              query.eq("schoolId", args.schoolId).eq("classId", classData._id)
            )
            .paginate(args.paginationOpts)
        );
      }

      return yield* Effect.promise(() =>
        ctx.db
          .query("schoolAssessments")
          .withIndex("by_schoolId_and_classId_and_status_and_order", (query) =>
            query
              .eq("schoolId", args.schoolId)
              .eq("classId", classData._id)
              .eq("status", "published")
          )
          .paginate(args.paginationOpts)
      );
    }

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
      schoolId: args.schoolId,
      userId: user.appUser._id,
    });

    return yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_order", (query) =>
          query.eq("schoolId", args.schoolId)
        )
        .paginate(args.paginationOpts)
    );
  }
);
