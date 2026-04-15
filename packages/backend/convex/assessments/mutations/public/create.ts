import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { validateScheduledStatus } from "@repo/backend/convex/assessments/helpers/publishing";
import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/richContent";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { slugify } from "@repo/backend/convex/utils/text";
import { v } from "convex/values";

/** Create one new authored assessment in one school scope. */
export const createAssessment = mutation({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
    title: v.string(),
    description: v.optional(richContentValidator),
    mode: v.union(
      v.literal("practice"),
      v.literal("assignment"),
      v.literal("quiz"),
      v.literal("exam"),
      v.literal("tryout")
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("scheduled")
    ),
    scheduledAt: v.optional(v.number()),
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

    validateScheduledStatus(args.status, args.scheduledAt);

    const slug = await generateUniqueAssessmentSlug(
      ctx,
      args.schoolId,
      slugify(args.title)
    );
    const now = Date.now();
    const isPublished = args.status === "published";
    const isScheduled = args.status === "scheduled";

    const assessmentId = await ctx.db.insert("schoolAssessments", {
      schoolId: args.schoolId,
      classId: args.classId,
      title: args.title,
      slug,
      description: args.description,
      mode: args.mode,
      status: args.status,
      questionBankScope: args.classId ? "class" : "school",
      createdBy: user.appUser._id,
      updatedBy: user.appUser._id,
      scheduledAt: isScheduled ? args.scheduledAt : undefined,
      publishedAt: isPublished ? now : undefined,
      publishedBy: isPublished ? user.appUser._id : undefined,
      updatedAt: now,
    });

    if (isScheduled && args.scheduledAt) {
      const scheduledJobId = await ctx.scheduler.runAfter(
        Math.max(args.scheduledAt - now, 0),
        internal.assessments.mutations.internal.publishing.publishAssessment,
        {
          assessmentId,
          publishedBy: user.appUser._id,
        }
      );

      await ctx.db.patch("schoolAssessments", assessmentId, {
        scheduledJobId,
      });
    }

    return assessmentId;
  },
});

/** Generate one school-local unique assessment slug from a title-derived base slug. */
async function generateUniqueAssessmentSlug(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  baseSlug: string
) {
  const safeBaseSlug = baseSlug || "assessment";
  let suffix = 0;

  while (true) {
    const candidateSlug =
      suffix === 0 ? safeBaseSlug : `${safeBaseSlug}-${suffix}`;
    const existing = await ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_slug", (q) =>
        q.eq("schoolId", schoolId).eq("slug", candidateSlug)
      )
      .unique();

    if (!existing) {
      return candidateSlug;
    }

    suffix += 1;
  }
}
