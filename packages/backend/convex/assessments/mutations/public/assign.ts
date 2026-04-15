import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";

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

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:publish"
    );

    await requireAssessment(ctx, args.schoolId, args.assessmentId);

    const assignmentId = await ctx.db.insert("schoolAssessmentAssignments", {
      schoolId: args.schoolId,
      assessmentId: args.assessmentId,
      versionId: args.versionId,
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
