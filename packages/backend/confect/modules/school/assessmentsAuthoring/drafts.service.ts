import { Ref } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { slugify } from "@repo/backend/confect/modules/content/contentSync.shared";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  requireAssessment,
  requireRichContentSize,
  validateScheduledStatus,
} from "@repo/backend/confect/modules/school/assessments.shared";
import {
  loadActiveClass,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Clock, Effect } from "effect";

/** Generates a unique assessment slug for a school. */
const generateUniqueAssessmentSlug = Effect.fn(
  "assessments.generateUniqueAssessmentSlug"
)(function* (
  ctx: ConvexMutationCtx,
  schoolId: Id<"schools">,
  baseSlug: string
) {
  const safeBaseSlug = baseSlug || "assessment";
  let suffix = 0;

  while (true) {
    const candidateSlug =
      suffix === 0 ? safeBaseSlug : `${safeBaseSlug}-${suffix}`;
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_slug", (query) =>
          query.eq("schoolId", schoolId).eq("slug", candidateSlug)
        )
        .unique()
    );

    if (!existing) {
      return candidateSlug;
    }

    suffix += 1;
  }
});

/** Computes the next order value for a school or class assessment list. */
const getNextAssessmentOrder = Effect.fn("assessments.getNextOrder")(function* (
  ctx: ConvexMutationCtx,
  schoolId: Id<"schools">,
  classId: Id<"schoolClasses"> | undefined
) {
  const lastAssessment = classId
    ? yield* Effect.promise(() =>
        ctx.db
          .query("schoolAssessments")
          .withIndex("by_schoolId_and_classId_and_order", (query) =>
            query.eq("schoolId", schoolId).eq("classId", classId)
          )
          .order("desc")
          .first()
      )
    : yield* Effect.promise(() =>
        ctx.db
          .query("schoolAssessments")
          .withIndex("by_schoolId_and_order", (query) =>
            query.eq("schoolId", schoolId)
          )
          .order("desc")
          .first()
      );

  return (lastAssessment?.order ?? -1) + 1;
});

/** Creates an editable assessment shell. */
export const createAssessment = Effect.fn("assessments.createAssessment")(
  function* (args: {
    readonly classId?: Id<"schoolClasses">;
    readonly description?: Doc<"schoolAssessments">["description"];
    readonly mode: Doc<"schoolAssessments">["mode"];
    readonly scheduledAt?: number;
    readonly schoolId: Id<"schools">;
    readonly status: Doc<"schoolAssessments">["status"];
    readonly title: string;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const now = yield* Clock.currentTimeMillis;
    const classData = args.classId
      ? yield* loadActiveClass(ctx, args.classId)
      : null;

    if (classData && classData.schoolId !== args.schoolId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "CLASS_NOT_FOUND",
          message: "Class not found in this school.",
        })
      );
    }

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_CREATE, {
      classId: classData?._id,
      schoolId: args.schoolId,
      userId: user.appUser._id,
    });

    if (args.description) {
      yield* requireRichContentSize(args.description, "Assessment description");
    }

    yield* validateScheduledStatus(args.status, args.scheduledAt, now);

    const slug = yield* generateUniqueAssessmentSlug(
      ctx,
      args.schoolId,
      slugify(args.title)
    );
    const isPublished = args.status === "published";
    const isScheduled = args.status === "scheduled";
    const order = yield* getNextAssessmentOrder(
      ctx,
      args.schoolId,
      classData?._id
    );
    const assessmentId = yield* Effect.promise(() =>
      ctx.db.insert("schoolAssessments", {
        classId: classData?._id,
        createdBy: user.appUser._id,
        description: args.description,
        mode: args.mode,
        order,
        publishedAt: isPublished ? now : undefined,
        publishedBy: isPublished ? user.appUser._id : undefined,
        questionBankScope: classData ? "class" : "school",
        scheduledAt: isScheduled ? args.scheduledAt : undefined,
        schoolId: args.schoolId,
        slug,
        status: args.status,
        title: args.title,
        updatedAt: now,
        updatedBy: user.appUser._id,
      })
    );

    const scheduledAt = args.scheduledAt;

    if (isScheduled && scheduledAt) {
      const scheduledJobId = yield* Effect.promise(() =>
        ctx.scheduler.runAfter(
          Math.max(scheduledAt - now, 0),
          Ref.getFunctionReference(
            refs.internal.assessments.mutations.internalFunctions.publishing
              .publishAssessment
          ),
          { assessmentId, publishedBy: user.appUser._id }
        )
      );
      yield* Effect.promise(() =>
        ctx.db.patch(assessmentId, { scheduledJobId })
      );
    }

    return assessmentId;
  }
);

/** Updates assessment metadata and publish scheduling. */
export const updateAssessment = Effect.fn("assessments.updateAssessment")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly description?: Doc<"schoolAssessments">["description"];
    readonly mode?: Doc<"schoolAssessments">["mode"];
    readonly scheduledAt?: number;
    readonly schoolId: Id<"schools">;
    readonly status?: Doc<"schoolAssessments">["status"];
    readonly title?: string;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const assessment = yield* requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );
    const now = yield* Clock.currentTimeMillis;

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
      classId: assessment.classId,
      schoolId: assessment.schoolId,
      userId: user.appUser._id,
    });

    if (args.description) {
      yield* requireRichContentSize(args.description, "Assessment description");
    }

    const nextStatus = args.status ?? assessment.status;
    const nextScheduledAt = args.scheduledAt ?? assessment.scheduledAt;
    yield* validateScheduledStatus(nextStatus, nextScheduledAt, now);

    const wasScheduled = assessment.status === "scheduled";
    const willBeScheduled = nextStatus === "scheduled";
    const timeChanged = nextScheduledAt !== assessment.scheduledAt;
    const needsCancel = wasScheduled && (!willBeScheduled || timeChanged);
    const needsSchedule = willBeScheduled && (!wasScheduled || timeChanged);
    const isNewlyPublished =
      nextStatus === "published" && assessment.status !== "published";
    let scheduledJobId = assessment.scheduledJobId;

    const currentScheduledJobId = assessment.scheduledJobId;

    if (needsCancel && currentScheduledJobId) {
      yield* Effect.promise(() => ctx.scheduler.cancel(currentScheduledJobId));
      scheduledJobId = undefined;
    }

    if (needsSchedule && nextScheduledAt) {
      scheduledJobId = yield* Effect.promise(() =>
        ctx.scheduler.runAfter(
          Math.max(nextScheduledAt - now, 0),
          Ref.getFunctionReference(
            refs.internal.assessments.mutations.internalFunctions.publishing
              .publishAssessment
          ),
          { assessmentId: args.assessmentId, publishedBy: user.appUser._id }
        )
      );
    }

    yield* Effect.promise(() =>
      ctx.db.patch(args.assessmentId, {
        description: args.description ?? assessment.description,
        mode: args.mode ?? assessment.mode,
        publishedAt: isNewlyPublished ? now : assessment.publishedAt,
        publishedBy: isNewlyPublished
          ? user.appUser._id
          : assessment.publishedBy,
        scheduledAt: willBeScheduled ? nextScheduledAt : undefined,
        scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
        status: nextStatus,
        title: args.title ?? assessment.title,
        updatedAt: now,
        updatedBy: user.appUser._id,
      })
    );

    return null;
  }
);
