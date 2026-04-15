import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** Publish one authored assessment when its scheduled release time arrives. */
export const publishAssessment = internalMutation({
  args: {
    assessmentId: vv.id("schoolAssessments"),
    publishedBy: vv.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assessment = await ctx.db.get("schoolAssessments", args.assessmentId);

    if (!assessment || assessment.status !== "scheduled") {
      return null;
    }

    await ctx.db.patch("schoolAssessments", args.assessmentId, {
      status: "published",
      scheduledJobId: undefined,
      publishedAt: Date.now(),
      publishedBy: args.publishedBy,
      updatedAt: Date.now(),
      updatedBy: args.publishedBy,
    });

    return null;
  },
});
