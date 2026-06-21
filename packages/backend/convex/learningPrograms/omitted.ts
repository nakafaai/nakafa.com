import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

const PROGRAM_RECONCILE_LIMIT = 100;
const OMITTED_PROGRAM_BATCH_SIZE = 100;

type OmittedProgramDeleteArgs = Readonly<{
  omittedAt: number;
  programId: Id<"learningPrograms">;
}>;
type OmittedDependencyRow =
  | Doc<"learningPlanItems">
  | Doc<"learningPlans">
  | Doc<"learningProfiles">
  | Doc<"learningProgramCoverage">
  | Doc<"learningProgramSources">;

/**
 * Deletes source-owned catalog rows omitted from the latest contents sync.
 *
 * Each omitted source-owned program is drained in bounded batches so generated
 * user-state rows cannot abort catalog sync when they exceed one transaction.
 * The program row is removed only after its dependent tables are empty.
 */
export async function deleteOmittedCatalogPrograms(
  ctx: MutationCtx,
  {
    incomingKeys,
    omittedAt,
  }: {
    incomingKeys: ReadonlySet<string>;
    omittedAt: number;
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
    if (!isSourceOwnedProgram(program)) {
      continue;
    }

    if (incomingKeys.has(program.key)) {
      continue;
    }

    const result = await deleteOmittedCatalogProgramBatch(ctx, {
      omittedAt,
      programId: program._id,
    });

    if (result.deleted) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Deletes one bounded dependency page for an omitted program.
 *
 * Continuations call this same server-owned seam until all dependent rows are
 * gone. A newer sync that rewrites the program row cancels the delete by
 * advancing `syncedAt` past the omission timestamp.
 */
export async function deleteOmittedCatalogProgramBatch(
  ctx: MutationCtx,
  args: OmittedProgramDeleteArgs
) {
  const program = await readDeletableProgram(ctx, args);

  if (!program) {
    return { deleted: false, scheduled: false };
  }

  if (await deletePlanItems(ctx, args)) {
    return { deleted: false, scheduled: true };
  }

  if (await deletePlans(ctx, args)) {
    return { deleted: false, scheduled: true };
  }

  if (await deleteProfiles(ctx, args)) {
    return { deleted: false, scheduled: true };
  }

  if (await deleteSources(ctx, args)) {
    return { deleted: false, scheduled: true };
  }

  if (await deleteCoverage(ctx, args)) {
    return { deleted: false, scheduled: true };
  }

  await ctx.db.delete(program._id);
  return { deleted: true, scheduled: false };
}

/** Checks whether a catalog row is owned by source sync and can be omitted. */
function isSourceOwnedProgram(program: Doc<"learningPrograms">) {
  return (
    program.providerKind === "official" || program.providerKind === "nakafa"
  );
}

/** Reloads the program row and cancels stale continuations after a newer sync. */
async function readDeletableProgram(
  ctx: MutationCtx,
  { omittedAt, programId }: OmittedProgramDeleteArgs
) {
  const program = await ctx.db.get(programId);

  if (!program) {
    return null;
  }

  if (!isSourceOwnedProgram(program) || program.syncedAt >= omittedAt) {
    return null;
  }

  return program;
}

/** Deletes one bounded page of generated plan items. */
async function deletePlanItems(
  ctx: MutationCtx,
  args: OmittedProgramDeleteArgs
) {
  const rows = await ctx.db
    .query("learningPlanItems")
    .withIndex("by_programId_and_lensId_and_content_id", (q) =>
      q.eq("programId", args.programId)
    )
    .take(OMITTED_PROGRAM_BATCH_SIZE);

  return await deleteRowsAndSchedule(ctx, args, rows);
}

/** Deletes one bounded page of generated learning plans. */
async function deletePlans(ctx: MutationCtx, args: OmittedProgramDeleteArgs) {
  const rows = await ctx.db
    .query("learningPlans")
    .withIndex("by_programId", (q) => q.eq("programId", args.programId))
    .take(OMITTED_PROGRAM_BATCH_SIZE);

  return await deleteRowsAndSchedule(ctx, args, rows);
}

/** Deletes one bounded page of active profile rows. */
async function deleteProfiles(
  ctx: MutationCtx,
  args: OmittedProgramDeleteArgs
) {
  const rows = await ctx.db
    .query("learningProfiles")
    .withIndex("by_programId", (q) => q.eq("programId", args.programId))
    .take(OMITTED_PROGRAM_BATCH_SIZE);

  return await deleteRowsAndSchedule(ctx, args, rows);
}

/** Deletes one bounded page of program source citations. */
async function deleteSources(ctx: MutationCtx, args: OmittedProgramDeleteArgs) {
  const rows = await ctx.db
    .query("learningProgramSources")
    .withIndex("by_programId", (q) => q.eq("programId", args.programId))
    .take(OMITTED_PROGRAM_BATCH_SIZE);

  return await deleteRowsAndSchedule(ctx, args, rows);
}

/** Deletes one bounded page of generated coverage rows. */
async function deleteCoverage(
  ctx: MutationCtx,
  args: OmittedProgramDeleteArgs
) {
  const rows = await ctx.db
    .query("learningProgramCoverage")
    .withIndex("by_programId_and_locale_and_lensId", (q) =>
      q.eq("programId", args.programId)
    )
    .take(OMITTED_PROGRAM_BATCH_SIZE);

  return await deleteRowsAndSchedule(ctx, args, rows);
}

/** Deletes a dependency page and returns whether another pass was scheduled. */
async function deleteRowsAndSchedule(
  ctx: MutationCtx,
  args: OmittedProgramDeleteArgs,
  rows: readonly OmittedDependencyRow[]
) {
  if (rows.length === 0) {
    return false;
  }

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }

  if (rows.length === OMITTED_PROGRAM_BATCH_SIZE) {
    await ctx.scheduler.runAfter(
      0,
      internal.learningPrograms.sync.continueOmittedProgramDelete,
      args
    );
    return true;
  }

  return false;
}
