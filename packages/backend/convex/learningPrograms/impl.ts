import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

const PLAN_COVERAGE_LIMIT = 12;

/** Returns the stable public summary for one persisted learning program. */
export function toLearningProgramSummary(program: Doc<"learningPrograms">) {
  return {
    coverageStatus: program.defaultCoverageStatus,
    description: program.description,
    displayOrder: program.displayOrder,
    key: program.key,
    kind: program.kind,
    locale: program.locale,
    title: program.title,
    versionLabel: program.versionLabel,
  };
}

/** Checks whether a catalog row can be selected for a learner's first plan. */
export function isLearningProgramSelectable(program: Doc<"learningPrograms">) {
  return (
    program.defaultCoverageStatus === "available" ||
    program.defaultCoverageStatus === "partial"
  );
}

/** Loads one learning program by its stable program key. */
export async function getLearningProgramByKey(
  ctx: MutationCtx,
  key: Doc<"learningPrograms">["key"]
) {
  return await ctx.db
    .query("learningPrograms")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** Marks all active plans for a user as superseded before creating a new plan. */
export async function supersedeActivePlans(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const plans = await ctx.db
    .query("learningPlans")
    .withIndex("by_userId_and_status", (q) =>
      q.eq("userId", userId).eq("status", "active")
    )
    .take(20);
  const now = Date.now();

  for (const plan of plans) {
    await ctx.db.patch(plan._id, { status: "superseded", updatedAt: now });
  }
}

/** Creates the first graph-backed plan items for a selected program. */
export async function createInitialLearningPlanItems(
  ctx: MutationCtx,
  {
    locale,
    planId,
    programId,
    userId,
  }: {
    locale: Doc<"learningProgramCoverage">["locale"];
    planId: Id<"learningPlans">;
    programId: Id<"learningPrograms">;
    userId: Id<"users">;
  }
) {
  const coverageRows = await loadPlanCoverageRows(ctx, { locale, programId });
  const now = Date.now();
  let position = 1;

  for (const row of coverageRows) {
    const route = await getContentRouteByContentId(ctx, {
      contentId: row.sampleContentId,
      locale,
    });

    await ctx.db.insert("learningPlanItems", {
      content_id: row.sampleContentId,
      coverageStatus: row.coverageStatus,
      createdAt: now,
      lensId: row.lensId,
      lensScope: row.lensScope,
      planId,
      position,
      programId,
      reason: "program-alignment",
      ...(route ? { route: route.route, title: route.title } : {}),
      status: "ready",
      updatedAt: now,
      userId,
    });

    position++;
  }
}

/** Loads bounded coverage rows in the order plans should consume them. */
async function loadPlanCoverageRows(
  ctx: MutationCtx,
  {
    locale,
    programId,
  }: {
    locale: Doc<"learningProgramCoverage">["locale"];
    programId: Id<"learningPrograms">;
  }
) {
  const available = await ctx.db
    .query("learningProgramCoverage")
    .withIndex("by_programId_and_locale_and_coverageStatus", (q) =>
      q
        .eq("programId", programId)
        .eq("locale", locale)
        .eq("coverageStatus", "available")
    )
    .take(PLAN_COVERAGE_LIMIT);

  if (available.length >= PLAN_COVERAGE_LIMIT) {
    return available;
  }

  const partial = await ctx.db
    .query("learningProgramCoverage")
    .withIndex("by_programId_and_locale_and_coverageStatus", (q) =>
      q
        .eq("programId", programId)
        .eq("locale", locale)
        .eq("coverageStatus", "partial")
    )
    .take(PLAN_COVERAGE_LIMIT - available.length);

  return [...available, ...partial];
}

/** Finds the matching content route for one graph asset ID and locale. */
async function getContentRouteByContentId(
  ctx: MutationCtx,
  {
    contentId,
    locale,
  }: {
    contentId: Doc<"learningProgramCoverage">["sampleContentId"];
    locale: Doc<"learningProgramCoverage">["locale"];
  }
) {
  const routes = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .take(5);

  return routes.find((route) => route.locale === locale) ?? null;
}
