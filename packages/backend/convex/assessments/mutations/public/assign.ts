import { requireAssessment } from "@repo/backend/convex/assessments/helpers/access";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { ConvexError, v } from "convex/values";

/** Publish one immutable version to one or more class targets. */
export const createAssignment = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
    versionId: v.id("schoolAssessmentVersions"),
    title: v.string(),
    classIds: v.array(v.id("schoolClasses")),
    opensAt: v.optional(v.number()),
    closesAt: v.optional(v.number()),
    releasesAt: v.optional(v.number()),
    timingPolicy: v.object({
      durationMinutes: v.optional(v.number()),
      perSection: v.boolean(),
    }),
    gradingMode: v.union(
      v.literal("auto"),
      v.literal("manual"),
      v.literal("hybrid")
    ),
    monitoringMode: v.union(
      v.literal("off"),
      v.literal("basic"),
      v.literal("strict")
    ),
    releaseMode: v.union(
      v.literal("instant"),
      v.literal("manual"),
      v.literal("scheduled")
    ),
    rankingScope: v.union(
      v.literal("none"),
      v.literal("class"),
      v.literal("school")
    ),
    retakePolicy: v.object({
      allowRetake: v.boolean(),
      maxAttempts: v.optional(v.number()),
    }),
  },
  returns: v.id("schoolAssessmentAssignments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.classIds.length === 0) {
      throw new ConvexError({
        code: "ASSIGNMENT_TARGET_REQUIRED",
        message: "Select at least one class target.",
      });
    }

    const assessment = await requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    await requirePermission(ctx, "assessment:publish", {
      userId: user.appUser._id,
      schoolId: assessment.schoolId,
      classId: assessment.classId,
    });

    const version = await ctx.db.get(
      "schoolAssessmentVersions",
      args.versionId
    );

    if (
      !version ||
      version.assessmentId !== assessment._id ||
      version.schoolId !== assessment.schoolId
    ) {
      throw new ConvexError({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found for this assessment.",
      });
    }

    const targetIds = new Set(args.classIds);

    if (targetIds.size !== args.classIds.length) {
      throw new ConvexError({
        code: "DUPLICATE_CLASS_TARGET",
        message: "Each class can only be assigned once.",
      });
    }

    const targetClasses = await Promise.all(
      args.classIds.map((classId) => loadActiveClass(ctx, classId))
    );

    if (
      targetClasses.some(
        (classData) => classData.schoolId !== assessment.schoolId
      )
    ) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      });
    }

    const assignmentId = await ctx.db.insert("schoolAssessmentAssignments", {
      schoolId: args.schoolId,
      assessmentId: args.assessmentId,
      versionId: version._id,
      title: args.title,
      status: args.opensAt ? "scheduled" : "published",
      opensAt: args.opensAt,
      closesAt: args.closesAt,
      releasesAt: args.releasesAt,
      timingPolicy: args.timingPolicy,
      gradingMode: args.gradingMode,
      monitoringMode: args.monitoringMode,
      releaseMode: args.releaseMode,
      rankingScope: args.rankingScope,
      retakePolicy: args.retakePolicy,
      createdBy: user.appUser._id,
      updatedBy: user.appUser._id,
      updatedAt: Date.now(),
      publishedAt: args.opensAt ? undefined : Date.now(),
    });

    for (const classId of args.classIds) {
      await ctx.db.insert("schoolAssessmentAssignmentTargets", {
        schoolId: args.schoolId,
        classId,
        assignmentId,
      });
    }

    return assignmentId;
  },
});
