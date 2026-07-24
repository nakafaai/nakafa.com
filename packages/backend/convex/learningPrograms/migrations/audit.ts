import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { loadProgramMappings } from "@repo/backend/convex/learningPrograms/migrations/catalog";
import type { programMigrationCountsValidator } from "@repo/backend/convex/learningPrograms/migrations/spec";
import { loadProgramState } from "@repo/backend/convex/learningPrograms/migrations/state";
import { loadVerifiedProgramCatalog } from "@repo/backend/convex/learningPrograms/snapshot";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ExpectedCounts = Infer<typeof programMigrationCountsValidator>;
type LegacyMapping = Readonly<{
  historicalKey: "id-kurikulum-merdeka" | "snbt-2026";
  programId: Doc<"learningPrograms">["_id"];
}>;

/** Audits the complete bounded rollout state before one migration batch. */
export const auditProgramIdentity = Effect.fn(
  "learningPrograms.auditProgramIdentity"
)(function* (
  ctx: MutationCtx,
  expected: ExpectedCounts,
  snapshotId: string,
  legacyMappings: readonly LegacyMapping[]
) {
  const signedPrograms = yield* loadVerifiedProgramCatalog(ctx, snapshotId);
  const programsById = yield* loadProgramMappings(
    ctx,
    expected,
    signedPrograms,
    legacyMappings
  );
  return yield* loadProgramState(ctx, expected, programsById, legacyMappings);
});
