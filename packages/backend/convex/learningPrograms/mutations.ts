import { mutation } from "@repo/backend/convex/functions";
import {
  createInitialLearningPlanItems,
  getLearningProgramByKey,
  supersedeActivePlans,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/impl";
import {
  activeLearningProfileValidator,
  learningObjectiveValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, v } from "convex/values";

/** Selects the user's active learning program and creates a first graph-backed plan. */
export const selectLearningProgram = mutation({
  args: {
    locale: localeValidator,
    objective: learningObjectiveValidator,
    programKey: v.string(),
    stage: v.optional(v.string()),
  },
  returns: activeLearningProfileValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const program = await getLearningProgramByKey(ctx, args.programKey);

    if (!program) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_NOT_FOUND",
        message: "Learning program not found.",
      });
    }

    if (
      program.defaultCoverageStatus === "hidden" ||
      program.defaultCoverageStatus === "archived"
    ) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_NOT_SELECTABLE",
        message: "Learning program is not selectable.",
      });
    }

    const now = Date.now();
    const existingProfile = await ctx.db
      .query("learningProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .unique();
    const profileId =
      existingProfile?._id ??
      (await ctx.db.insert("learningProfiles", {
        locale: args.locale,
        objective: args.objective,
        programId: program._id,
        stage: args.stage,
        updatedAt: now,
        userId: user.appUser._id,
      }));

    await supersedeActivePlans(ctx, user.appUser._id);

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        activePlanId: undefined,
        locale: args.locale,
        objective: args.objective,
        programId: program._id,
        stage: args.stage,
        updatedAt: now,
      });
    }

    const planId = await ctx.db.insert("learningPlans", {
      createdAt: now,
      profileId,
      programId: program._id,
      status: "active",
      updatedAt: now,
      userId: user.appUser._id,
      version: 1,
    });

    await createInitialLearningPlanItems(ctx, {
      locale: args.locale,
      planId,
      programId: program._id,
      userId: user.appUser._id,
    });
    await ctx.db.patch(profileId, { activePlanId: planId, updatedAt: now });

    const planItems = await ctx.db
      .query("learningPlanItems")
      .withIndex("by_planId_and_position", (q) => q.eq("planId", planId))
      .take(20);

    return {
      objective: args.objective,
      planItems: planItems.map((item) => ({
        content_id: item.content_id,
        lensId: item.lensId,
        position: item.position,
        reason: item.reason,
        route: item.route,
        status: item.status,
        title: item.title,
      })),
      program: toLearningProgramSummary(program),
      stage: args.stage,
    };
  },
});
