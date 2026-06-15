import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  LearningOutcomeSyncInput,
  OutcomeConceptAlignmentSyncInput,
  ProgramOutlineNodeSyncInput,
} from "@repo/backend/convex/learningPrograms/outcomes";
import {
  deleteStaleOutcomeReadModelRows,
  getProgramIdsByKey,
  getRequiredProgramId,
  upsertLearningOutcome,
  upsertOutcomeConceptAlignment,
  upsertProgramOutlineNode,
} from "@repo/backend/convex/learningPrograms/rows";
import {
  LearningOutcomeSchema,
  OutcomeConceptAlignmentSchema,
  ProgramOutlineNodeSchema,
} from "@repo/contents/_types/outcome/schema";
import { ConvexError } from "convex/values";
import { Either, Schema } from "effect";

const OUTCOME_RECONCILE_LIMIT = 500;
const LearningProgramOutcomeSyncInputSchema = Schema.Struct({
  conceptAlignments: Schema.Array(OutcomeConceptAlignmentSchema),
  outcomes: Schema.Array(LearningOutcomeSchema),
  outlineNodes: Schema.Array(ProgramOutlineNodeSchema),
});

/** Projects source-registry outcomes and outlines into generated Convex rows. */
export async function syncLearningProgramOutcomeRows(
  ctx: MutationCtx,
  input: {
    conceptAlignments: OutcomeConceptAlignmentSyncInput[];
    outcomes: LearningOutcomeSyncInput[];
    outlineNodes: ProgramOutlineNodeSyncInput[];
    syncedAt: number;
  }
) {
  const registry = decodeLearningProgramOutcomesForSync(input);
  assertOutcomeBatchSize(registry);

  const programIds = await getProgramIdsByKey(ctx, [
    ...new Set([
      ...registry.outlineNodes.map((node) => node.programKey),
      ...registry.outcomes.map((outcome) => outcome.programKey),
    ]),
  ]);
  const outlineKeys = new Set(registry.outlineNodes.map((node) => node.key));
  const outcomesByKey = new Map(
    registry.outcomes.map((outcome) => [outcome.key, outcome])
  );
  let created = 0;
  let updated = 0;

  for (const node of registry.outlineNodes) {
    if (node.parentKey && !outlineKeys.has(node.parentKey)) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_OUTLINE_PARENT_NOT_FOUND",
        message: "Learning program outline node references a missing parent.",
      });
    }

    const result = await upsertProgramOutlineNode(ctx, {
      node,
      programId: getRequiredProgramId(programIds, node.programKey),
      syncedAt: input.syncedAt,
    });
    created += result.created;
    updated += result.updated;
  }

  for (const outcome of registry.outcomes) {
    if (!outlineKeys.has(outcome.outlineKey)) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_OUTCOME_OUTLINE_NOT_FOUND",
        message: "Learning program outcome references a missing outline node.",
      });
    }

    const result = await upsertLearningOutcome(ctx, {
      outcome,
      programId: getRequiredProgramId(programIds, outcome.programKey),
      syncedAt: input.syncedAt,
    });
    created += result.created;
    updated += result.updated;
  }

  for (const alignment of registry.conceptAlignments) {
    const outcome = outcomesByKey.get(alignment.outcomeKey);
    if (!outcome) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_OUTCOME_NOT_FOUND",
        message:
          "Learning program concept alignment references a missing outcome.",
      });
    }

    const result = await upsertOutcomeConceptAlignment(ctx, {
      alignment,
      programId: getRequiredProgramId(programIds, outcome.programKey),
      syncedAt: input.syncedAt,
    });
    created += result.created;
    updated += result.updated;
  }

  updated += await deleteStaleOutcomeReadModelRows(ctx, input.syncedAt);

  return { created, skipped: 0, updated };
}

/** Decodes outcome sync rows through the Effect-owned outcome registry contract. */
function decodeLearningProgramOutcomesForSync(input: {
  conceptAlignments: OutcomeConceptAlignmentSyncInput[];
  outcomes: LearningOutcomeSyncInput[];
  outlineNodes: ProgramOutlineNodeSyncInput[];
}) {
  const decoded = Schema.decodeUnknownEither(
    LearningProgramOutcomeSyncInputSchema
  )(input);

  if (Either.isLeft(decoded)) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_OUTCOME_REGISTRY_INVALID",
      message:
        "Learning program outcome sync received rows outside the contents registry contract.",
    });
  }

  return decoded.right;
}

/** Ensures source-controlled outcome batches stay within one transaction. */
function assertOutcomeBatchSize({
  conceptAlignments,
  outcomes,
  outlineNodes,
}: {
  conceptAlignments: readonly unknown[];
  outcomes: readonly unknown[];
  outlineNodes: readonly unknown[];
}) {
  if (
    conceptAlignments.length > OUTCOME_RECONCILE_LIMIT ||
    outcomes.length > OUTCOME_RECONCILE_LIMIT ||
    outlineNodes.length > OUTCOME_RECONCILE_LIMIT
  ) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_OUTCOME_LIMIT_EXCEEDED",
      message: `Learning program outcome sync is limited to ${OUTCOME_RECONCILE_LIMIT} rows per collection.`,
    });
  }
}
