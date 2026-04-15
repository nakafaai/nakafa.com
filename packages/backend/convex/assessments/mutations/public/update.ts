import { internal } from "@repo/backend/convex/_generated/api";
import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/content";
import { validateScheduledStatus } from "@repo/backend/convex/assessments/helpers/publishing";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";

/** Update one authored assessment while it remains editable. */
export const updateAssessment = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
    title: v.optional(v.string()),
    description: v.optional(richContentValidator),
    mode: v.optional(
      v.union(
        v.literal("practice"),
        v.literal("assignment"),
        v.literal("quiz"),
        v.literal("exam"),
        v.literal("tryout")
      )
    ),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("scheduled"),
        v.literal("archived")
      )
    ),
    scheduledAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:update"
    );

    const assessment = await requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    if (args.description) {
      requireRichContentSize(args.description, "Assessment description");
    }

    const nextStatus = args.status ?? assessment.status;
    const nextScheduledAt = args.scheduledAt ?? assessment.scheduledAt;

    validateScheduledStatus(nextStatus, nextScheduledAt);

    const now = Date.now();
    const wasScheduled = assessment.status === "scheduled";
    const willBeScheduled = nextStatus === "scheduled";
    const timeChanged = nextScheduledAt !== assessment.scheduledAt;
    const needsCancel = wasScheduled && (!willBeScheduled || timeChanged);
    const needsSchedule = willBeScheduled && (!wasScheduled || timeChanged);
    const isNewlyPublished =
      nextStatus === "published" && assessment.status !== "published";

    let scheduledJobId = assessment.scheduledJobId;

    if (needsCancel && assessment.scheduledJobId) {
      await ctx.scheduler.cancel(assessment.scheduledJobId);
      scheduledJobId = undefined;
    }

    if (needsSchedule && nextScheduledAt) {
      scheduledJobId = await ctx.scheduler.runAfter(
        Math.max(nextScheduledAt - now, 0),
        internal.assessments.mutations.internal.publishing.publishAssessment,
        {
          assessmentId: args.assessmentId,
          publishedBy: user.appUser._id,
        }
      );
    }

    await ctx.db.patch("schoolAssessments", args.assessmentId, {
      title: args.title ?? assessment.title,
      description: args.description ?? assessment.description,
      mode: args.mode ?? assessment.mode,
      status: nextStatus,
      scheduledAt: willBeScheduled ? nextScheduledAt : undefined,
      scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
      publishedAt: isNewlyPublished ? now : assessment.publishedAt,
      publishedBy: isNewlyPublished ? user.appUser._id : assessment.publishedBy,
      updatedBy: user.appUser._id,
      updatedAt: now,
    });

    return null;
  },
});
