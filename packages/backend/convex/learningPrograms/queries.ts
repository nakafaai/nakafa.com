import { query } from "@repo/backend/convex/_generated/server";
import {
  hasLearningProgramCoverageForLocale,
  isLearningProgramSelectable,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/impl";
import {
  activeLearningProfileValidator,
  learningProgramSummaryValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";

const PROGRAM_LIMIT = 50;
const PLAN_ITEM_LIMIT = 20;

/** Lists selectable learning programs from the Convex catalog. */
export const listSelectablePrograms = query({
  args: {
    locale: v.optional(localeValidator),
  },
  returns: v.array(learningProgramSummaryValidator),
  handler: async (ctx, args) => {
    const programs = await ctx.db
      .query("learningPrograms")
      .withIndex("by_displayOrder")
      .take(PROGRAM_LIMIT);
    const selectablePrograms = programs.filter(isLearningProgramSelectable);

    if (!args.locale) {
      return selectablePrograms.map((program) =>
        toLearningProgramSummary(program)
      );
    }

    const programsWithCoverage: typeof selectablePrograms = [];

    for (const program of selectablePrograms) {
      if (
        await hasLearningProgramCoverageForLocale(ctx, {
          locale: args.locale,
          programId: program._id,
        })
      ) {
        programsWithCoverage.push(program);
      }
    }

    return programsWithCoverage.map((program) =>
      toLearningProgramSummary(program, args.locale)
    );
  },
});

/** Returns the current user's active profile and first learning plan items. */
export const getActiveProfile = query({
  args: {
    locale: v.optional(localeValidator),
  },
  returns: activeLearningProfileValidator,
  handler: async (ctx, args) => {
    const user = await getOptionalAppUser(ctx);

    if (!user) {
      return null;
    }

    const profile = await ctx.db
      .query("learningProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .unique();

    if (!profile) {
      return null;
    }

    const program = await ctx.db.get(profile.programId);

    if (!program) {
      return null;
    }

    const activePlanId = profile.activePlanId;
    const planItems = activePlanId
      ? await ctx.db
          .query("learningPlanItems")
          .withIndex("by_planId_and_position", (q) =>
            q.eq("planId", activePlanId)
          )
          .take(PLAN_ITEM_LIMIT)
      : [];

    return {
      interests: profile.interests,
      planItems: planItems.map((item) => ({
        content_id: item.content_id,
        lensId: item.lensId,
        position: item.position,
        reason: item.reason,
        route: item.route,
        status: item.status,
        title: item.title,
      })),
      program: toLearningProgramSummary(program, args.locale),
      stage: profile.stage,
    };
  },
});
