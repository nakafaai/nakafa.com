import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/richContent";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { ConvexError, v } from "convex/values";

/** Create one new authored assessment in one school scope. */
export const createAssessment = mutation({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
    title: v.string(),
    slug: v.string(),
    description: v.optional(richContentValidator),
    mode: v.union(
      v.literal("practice"),
      v.literal("assignment"),
      v.literal("quiz"),
      v.literal("exam"),
      v.literal("tryout")
    ),
    questionBankScope: v.union(v.literal("class"), v.literal("school")),
  },
  returns: v.id("schoolAssessments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requirePermission(ctx, "assessment:create", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
      classId: args.classId,
    });

    if (args.description) {
      requireRichContentSize(args.description, "Assessment description");
    }

    const existing = await ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_slug", (q) =>
        q.eq("schoolId", args.schoolId).eq("slug", args.slug)
      )
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "ASSESSMENT_SLUG_CONFLICT",
        message: `Assessment slug already exists for slug: ${args.slug}`,
      });
    }

    return ctx.db.insert("schoolAssessments", {
      schoolId: args.schoolId,
      classId: args.classId,
      title: args.title,
      slug: args.slug,
      description: args.description,
      mode: args.mode,
      status: "draft",
      questionBankScope: args.questionBankScope,
      createdBy: user.appUser._id,
      updatedBy: user.appUser._id,
      updatedAt: Date.now(),
    });
  },
});
