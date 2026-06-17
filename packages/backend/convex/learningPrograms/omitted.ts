import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

const PROGRAM_RECONCILE_LIMIT = 100;
const OMITTED_PROGRAM_DEPENDENCY_LIMIT = 500;

/**
 * Deletes source-owned catalog rows omitted from the latest contents sync.
 *
 * This is the clean-cut catalog reconcile seam: omitted official/Nakafa rows are
 * removed with their generated source, coverage, plan, profile, and plan-item
 * dependents so omitted program keys cannot survive as stale catalog rows.
 */
export async function deleteOmittedCatalogPrograms(
  ctx: MutationCtx,
  {
    incomingKeys,
  }: {
    incomingKeys: ReadonlySet<string>;
  }
) {
  const existingPrograms = await ctx.db
    .query("learningPrograms")
    .withIndex("by_displayOrder")
    .take(PROGRAM_RECONCILE_LIMIT + 1);

  if (existingPrograms.length > PROGRAM_RECONCILE_LIMIT) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_RECONCILE_LIMIT_EXCEEDED",
      message: `Learning program catalog reconciliation is limited to ${PROGRAM_RECONCILE_LIMIT} rows.`,
    });
  }

  let deleted = 0;

  for (const program of existingPrograms) {
    if (
      program.providerKind !== "official" &&
      program.providerKind !== "nakafa"
    ) {
      continue;
    }

    if (incomingKeys.has(program.key)) {
      continue;
    }

    await deleteOmittedProgramDependents(ctx, program._id);
    await ctx.db.delete(program._id);
    deleted++;
  }

  return deleted;
}

/**
 * Removes generated and user-state rows that point at an omitted program.
 */
async function deleteOmittedProgramDependents(
  ctx: MutationCtx,
  programId: Id<"learningPrograms">
) {
  await deleteBoundedProgramPlanItems(ctx, programId);
  await deleteBoundedProgramPlans(ctx, programId);
  await deleteBoundedProgramProfiles(ctx, programId);
  await deleteBoundedProgramSources(ctx, programId);
  await deleteBoundedProgramCoverage(ctx, programId);
}

/**
 * Deletes source citations for one omitted program within the reconcile limit.
 */
async function deleteBoundedProgramSources(
  ctx: MutationCtx,
  programId: Id<"learningPrograms">
) {
  const sources = await ctx.db
    .query("learningProgramSources")
    .withIndex("by_programId", (q) => q.eq("programId", programId))
    .take(OMITTED_PROGRAM_DEPENDENCY_LIMIT + 1);

  assertOmittedProgramDependencyLimit({
    count: sources.length,
    dependency: "sources",
  });

  for (const source of sources) {
    await ctx.db.delete(source._id);
  }
}

/**
 * Deletes generated plan items for one omitted program within the reconcile limit.
 */
async function deleteBoundedProgramPlanItems(
  ctx: MutationCtx,
  programId: Id<"learningPrograms">
) {
  const planItems = await ctx.db
    .query("learningPlanItems")
    .withIndex("by_programId_and_lensId_and_content_id", (q) =>
      q.eq("programId", programId)
    )
    .take(OMITTED_PROGRAM_DEPENDENCY_LIMIT + 1);

  assertOmittedProgramDependencyLimit({
    count: planItems.length,
    dependency: "plan items",
  });

  for (const item of planItems) {
    await ctx.db.delete(item._id);
  }
}

/**
 * Deletes learning plans for one omitted source-owned program within the reconcile limit.
 */
async function deleteBoundedProgramPlans(
  ctx: MutationCtx,
  programId: Id<"learningPrograms">
) {
  const plans = await ctx.db
    .query("learningPlans")
    .withIndex("by_programId", (q) => q.eq("programId", programId))
    .take(OMITTED_PROGRAM_DEPENDENCY_LIMIT + 1);

  assertOmittedProgramDependencyLimit({
    count: plans.length,
    dependency: "plans",
  });

  for (const plan of plans) {
    await ctx.db.delete(plan._id);
  }
}

/**
 * Deletes learning profiles for one omitted source-owned program within the reconcile limit.
 */
async function deleteBoundedProgramProfiles(
  ctx: MutationCtx,
  programId: Id<"learningPrograms">
) {
  const profiles = await ctx.db
    .query("learningProfiles")
    .withIndex("by_programId", (q) => q.eq("programId", programId))
    .take(OMITTED_PROGRAM_DEPENDENCY_LIMIT + 1);

  assertOmittedProgramDependencyLimit({
    count: profiles.length,
    dependency: "profiles",
  });

  for (const profile of profiles) {
    await ctx.db.delete(profile._id);
  }
}

/**
 * Deletes generated coverage rows for one omitted program within the reconcile limit.
 */
async function deleteBoundedProgramCoverage(
  ctx: MutationCtx,
  programId: Id<"learningPrograms">
) {
  const coverageRows = await ctx.db
    .query("learningProgramCoverage")
    .withIndex("by_programId_and_locale_and_lensId", (q) =>
      q.eq("programId", programId)
    )
    .take(OMITTED_PROGRAM_DEPENDENCY_LIMIT + 1);

  assertOmittedProgramDependencyLimit({
    count: coverageRows.length,
    dependency: "coverage rows",
  });

  for (const row of coverageRows) {
    await ctx.db.delete(row._id);
  }
}

/**
 * Guards catalog reconciliation from deleting unbounded program dependencies.
 */
function assertOmittedProgramDependencyLimit({
  count,
  dependency,
}: {
  count: number;
  dependency: string;
}) {
  if (count <= OMITTED_PROGRAM_DEPENDENCY_LIMIT) {
    return;
  }

  throw new ConvexError({
    code: "LEARNING_PROGRAM_DEPENDENCY_RECONCILE_LIMIT_EXCEEDED",
    message: `Learning program catalog reconciliation found more than ${OMITTED_PROGRAM_DEPENDENCY_LIMIT} ${dependency} for an omitted program.`,
  });
}
