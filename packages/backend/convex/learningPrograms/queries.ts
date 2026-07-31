import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import {
  hasLearningProgramCoverageForLocale,
  isLearningProgramSelectable,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/impl";
import { loadLearningPlanTarget } from "@repo/backend/convex/learningPrograms/planTarget";
import {
  activeLearningProfileValidator,
  learningProgramSummaryValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { Effect } from "effect";

const PROGRAM_LIMIT = 50;
const PLAN_ITEM_LIMIT = 20;

/** Selects the stable plan facts plus either stored or current route facts. */
function toPlanItemView(
  item: Doc<"learningPlanItems">,
  target:
    | {
        readonly route: string;
        readonly title: string;
      }
    | null
    | undefined
) {
  const route = target === undefined ? item.route : target?.route;
  const title = target === undefined ? item.title : target?.title;

  return {
    content_id: item.content_id,
    lensId: item.lensId,
    position: item.position,
    reason: item.reason,
    route,
    status: item.status,
    title,
  };
}

/** Resolves stored plan items through current content ownership when localized. */
const loadPlanItemViews = Effect.fn("learningPrograms.loadPlanItemViews")(
  function* (
    ctx: QueryCtx,
    items: readonly Doc<"learningPlanItems">[],
    locale: Doc<"learningProgramCoverage">["locale"] | undefined
  ) {
    if (locale === undefined) {
      return items.map((item) => toPlanItemView(item, undefined));
    }

    return yield* Effect.forEach(items, (item) =>
      Effect.map(
        loadLearningPlanTarget(ctx, item.content_id, locale),
        (target) => toPlanItemView(item, target)
      )
    );
  }
);

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
    const user = await getOptionalAppUserForRead(ctx);

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
    const planItemViews = await runConvexProgram(
      loadPlanItemViews(ctx, planItems, args.locale)
    );

    return {
      interests: profile.interests,
      planItems: planItemViews,
      program: toLearningProgramSummary(program, args.locale),
      stage: profile.stage,
    };
  },
});
