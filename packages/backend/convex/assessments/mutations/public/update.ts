import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/richContent";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Update one authored assessment while it remains editable. */
export const updateAssessment = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(richContentValidator),
    questionBankScope: v.optional(
      v.union(v.literal("class"), v.literal("school"))
    ),
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

    if (assessment.status === "archived") {
      throw new ConvexError({
        code: "ASSESSMENT_ARCHIVED",
        message: "Archived assessments cannot be updated.",
      });
    }

    if (args.description) {
      requireRichContentSize(args.description, "Assessment description");
    }

    const nextSlug = args.slug;

    if (nextSlug && nextSlug !== assessment.slug) {
      const existing = await ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_slug", (q) =>
          q.eq("schoolId", args.schoolId).eq("slug", nextSlug)
        )
        .unique();

      if (existing && existing._id !== assessment._id) {
        throw new ConvexError({
          code: "ASSESSMENT_SLUG_CONFLICT",
          message: `Assessment slug already exists for slug: ${nextSlug}`,
        });
      }
    }

    await ctx.db.patch("schoolAssessments", args.assessmentId, {
      title: args.title,
      slug: args.slug,
      description: args.description,
      questionBankScope: args.questionBankScope,
      updatedBy: user.appUser._id,
      updatedAt: Date.now(),
    });

    return null;
  },
});
