import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  LearningOutcomeSyncInput,
  OutcomeConceptAlignmentSyncInput,
  ProgramOutlineNodeSyncInput,
} from "@repo/backend/convex/learningPrograms/outcomes";
import { ConvexError } from "convex/values";

const OUTCOME_RECONCILE_LIMIT = 500;

/** Loads generated Convex program IDs by canonical program key. */
export async function getProgramIdsByKey(
  ctx: MutationCtx,
  keys: readonly string[]
) {
  const ids = new Map<string, Id<"learningPrograms">>();

  for (const key of keys) {
    const program = await ctx.db
      .query("learningPrograms")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!program) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_NOT_FOUND",
        message: `Learning program not found for outcome registry key "${key}".`,
      });
    }

    ids.set(key, program._id);
  }

  return ids;
}

/** Reads a generated program ID or fails with a typed Convex error. */
export function getRequiredProgramId(
  ids: ReadonlyMap<string, Id<"learningPrograms">>,
  key: string
) {
  const programId = ids.get(key);

  if (!programId) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_NOT_FOUND",
      message: `Learning program not found for outcome registry key "${key}".`,
    });
  }

  return programId;
}

/** Upserts one generated program outline node. */
export async function upsertProgramOutlineNode(
  ctx: MutationCtx,
  {
    node,
    programId,
    syncedAt,
  }: {
    node: ProgramOutlineNodeSyncInput;
    programId: Id<"learningPrograms">;
    syncedAt: number;
  }
) {
  const row = {
    displayOrder: node.displayOrder,
    key: node.key,
    level: node.level,
    parentKey: node.parentKey,
    programId,
    programKey: node.programKey,
    syncedAt,
    translations: node.translations,
    updatedAt: syncedAt,
  };
  const existing = await ctx.db
    .query("learningProgramOutlineNodes")
    .withIndex("by_programId_and_key", (q) =>
      q.eq("programId", programId).eq("key", node.key)
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("learningProgramOutlineNodes", row);
    return { created: 1, updated: 0 };
  }

  await ctx.db.replace(existing._id, row);
  return { created: 0, updated: 1 };
}

/** Upserts one source-cited official or Nakafa-authored outcome row. */
export async function upsertLearningOutcome(
  ctx: MutationCtx,
  {
    outcome,
    programId,
    syncedAt,
  }: {
    outcome: LearningOutcomeSyncInput;
    programId: Id<"learningPrograms">;
    syncedAt: number;
  }
) {
  const row = {
    code: outcome.code,
    key: outcome.key,
    outlineKey: outcome.outlineKey,
    programId,
    programKey: outcome.programKey,
    sourceLabel: outcome.source.label,
    sourceRetrievedAt: outcome.source.retrievedAt,
    sourceReviewAfter: outcome.source.reviewAfter,
    sourceType: outcome.source.type,
    sourceUrl: outcome.source.url,
    status: outcome.status,
    syncedAt,
    translations: outcome.translations,
    updatedAt: syncedAt,
    versionLabel: outcome.versionLabel,
  };
  const existing = await ctx.db
    .query("learningProgramOutcomes")
    .withIndex("by_programId_and_key", (q) =>
      q.eq("programId", programId).eq("key", outcome.key)
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("learningProgramOutcomes", row);
    return { created: 1, updated: 0 };
  }

  await ctx.db.replace(existing._id, row);
  return { created: 0, updated: 1 };
}

/** Upserts one generated outcome-to-concept alignment row. */
export async function upsertOutcomeConceptAlignment(
  ctx: MutationCtx,
  {
    alignment,
    programId,
    syncedAt,
  }: {
    alignment: OutcomeConceptAlignmentSyncInput;
    programId: Id<"learningPrograms">;
    syncedAt: number;
  }
) {
  const row = {
    conceptKey: alignment.conceptKey,
    evidence: alignment.evidence,
    outcomeKey: alignment.outcomeKey,
    programId,
    relation: alignment.relation,
    reviewedAt: alignment.reviewedAt,
    syncedAt,
  };
  const existing = await ctx.db
    .query("learningProgramOutcomeConcepts")
    .withIndex("by_programId_and_outcomeKey_and_conceptKey", (q) =>
      q
        .eq("programId", programId)
        .eq("outcomeKey", alignment.outcomeKey)
        .eq("conceptKey", alignment.conceptKey)
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("learningProgramOutcomeConcepts", row);
    return { created: 1, updated: 0 };
  }

  await ctx.db.replace(existing._id, row);
  return { created: 0, updated: 1 };
}

/** Deletes omitted generated outcome rows after the new registry has synced. */
export async function deleteStaleOutcomeReadModelRows(
  ctx: MutationCtx,
  syncedAt: number
) {
  const deletedConcepts = await deleteStaleOutcomeConcepts(ctx, syncedAt);
  const deletedOutcomes = await deleteStaleOutcomes(ctx, syncedAt);
  const deletedOutlineNodes = await deleteStaleOutlineNodes(ctx, syncedAt);

  return deletedConcepts + deletedOutcomes + deletedOutlineNodes;
}

/** Deletes stale outcome-to-concept rows from one full registry sync. */
async function deleteStaleOutcomeConcepts(ctx: MutationCtx, syncedAt: number) {
  let deleted = 0;
  const rows = await ctx.db
    .query("learningProgramOutcomeConcepts")
    .withIndex("by_syncedAt", (q) => q.lt("syncedAt", syncedAt))
    .take(OUTCOME_RECONCILE_LIMIT + 1);

  assertStaleOutcomeDeleteLimit(rows.length);
  for (const row of rows) {
    await ctx.db.delete(row._id);
    deleted++;
  }

  return deleted;
}

/** Deletes stale source-cited outcome rows from one full registry sync. */
async function deleteStaleOutcomes(ctx: MutationCtx, syncedAt: number) {
  let deleted = 0;
  const rows = await ctx.db
    .query("learningProgramOutcomes")
    .withIndex("by_syncedAt", (q) => q.lt("syncedAt", syncedAt))
    .take(OUTCOME_RECONCILE_LIMIT + 1);

  assertStaleOutcomeDeleteLimit(rows.length);
  for (const row of rows) {
    await ctx.db.delete(row._id);
    deleted++;
  }

  return deleted;
}

/** Deletes stale outline nodes from one full registry sync. */
async function deleteStaleOutlineNodes(ctx: MutationCtx, syncedAt: number) {
  let deleted = 0;
  const rows = await ctx.db
    .query("learningProgramOutlineNodes")
    .withIndex("by_syncedAt", (q) => q.lt("syncedAt", syncedAt))
    .take(OUTCOME_RECONCILE_LIMIT + 1);

  assertStaleOutcomeDeleteLimit(rows.length);
  for (const row of rows) {
    await ctx.db.delete(row._id);
    deleted++;
  }

  return deleted;
}

/** Fails closed before one transaction tries to reconcile too many rows. */
function assertStaleOutcomeDeleteLimit(rowCount: number) {
  if (rowCount <= OUTCOME_RECONCILE_LIMIT) {
    return;
  }

  throw new ConvexError({
    code: "LEARNING_PROGRAM_OUTCOME_RECONCILE_LIMIT_EXCEEDED",
    message: `Learning program outcome reconciliation is limited to ${OUTCOME_RECONCILE_LIMIT} rows.`,
  });
}
