import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  readAuditFacts,
  validateQuiescentPublication,
} from "@repo/backend/convex/contentRelease/cutover/facts";
import { proveFreezeHistory } from "@repo/backend/convex/contentRelease/cutover/history";
import {
  CURRENT_INVENTORY,
  LEGACY_INVENTORY,
  RETENTION_INVENTORY,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { countAuditedTable } from "@repo/backend/convex/contentRelease/cutover/scan";
import type { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { proveRetainedHistoryComplete } from "@repo/backend/convex/tryouts/history/readiness";
import {
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { makeFunctionReference } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const freezeReceiptValidator = v.object({
  attempts: v.number(),
  catalogRows: v.number(),
  frozen: v.literal(true),
  frozenPlacements: v.number(),
  markers: v.number(),
  placementRows: v.number(),
  progressRows: v.number(),
  snapshotId: v.string(),
});
interface FreezeReceipt {
  readonly attempts: number;
  readonly catalogRows: number;
  readonly frozen: true;
  readonly frozenPlacements: number;
  readonly markers: number;
  readonly placementRows: number;
  readonly progressRows: number;
  readonly snapshotId: string;
}
type CutoverPhase = Infer<typeof cutoverPhaseValidator>;
const armReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("contentRelease/cutover/freeze:arm");
const commitReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  FreezeReceipt
>("contentRelease/cutover/freeze:commit");
const verifyArtifactsReference = makeFunctionReference<
  "action",
  Record<string, never>,
  { artifacts: number; placements: number }
>("contentRelease/cutover/artifacts:verify");
const phaseReference = makeFunctionReference<
  "query",
  Record<string, never>,
  CutoverPhase | null
>("contentRelease/cutover/quiescence:phase");

/** Irreversibly arms the guard after matching the exact audited pointer. */
export const arm = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => runConvexProgram(armFreeze(ctx)),
});

/**
 * Proves immutable history and removes the old publication pointer in one
 * transaction after a separately committed guard arm.
 */
export const commit = internalMutation({
  args: {},
  returns: freezeReceiptValidator,
  handler: (ctx) =>
    runConvexProgram(
      freezeProgram(ctx, retainedTryoutHistoryPlan).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});

/** Arms downtime, re-audits exact current state, then commits the freeze. */
export const freeze = internalAction({
  args: {},
  returns: freezeReceiptValidator,
  handler: (ctx) => runConvexActionProgram(runFreeze(ctx)),
});

const runFreeze = Effect.fn("contentRelease.cutover.runFreeze")(function* (
  ctx: ActionCtx
) {
  yield* callInternal(() => ctx.runMutation(armReference, {}));
  const phase = yield* callInternal(() => ctx.runQuery(phaseReference, {}));
  if (phase === "freeze-armed") {
    for (const entry of [...CURRENT_INVENTORY, ...RETENTION_INVENTORY]) {
      const count = yield* countAuditedTable(ctx, entry.table);
      if (count !== entry.expected) {
        return yield* freezeFailure(
          `${entry.table} expected ${entry.expected} rows but found ${count}.`
        );
      }
    }
  }
  yield* callInternal(() => ctx.runAction(verifyArtifactsReference, {}));
  return yield* callInternal(() => ctx.runMutation(commitReference, {}));
});

const armFreeze = Effect.fn("contentRelease.cutover.armFreeze")(function* (
  ctx: MutationCtx
) {
  const cutover = yield* requireCutoverPhase(ctx, [
    "legacy-drained",
    "freeze-armed",
    "frozen",
    "draining-current",
    "complete",
    "proved",
  ]);
  if (cutover.phase !== "legacy-drained") {
    return null;
  }
  yield* verifyAuditedPointer(ctx, cutover);
  yield* proveLegacyTablesEmpty(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", cutover._id, {
      phase: "freeze-armed",
      updatedAt: Date.now(),
    })
  );
  return null;
});

/** Re-proves every legacy table is empty before the irreversible freeze. */
const proveLegacyTablesEmpty = Effect.fn(
  "contentRelease.cutover.proveLegacyTablesEmpty"
)(function* (ctx: MutationCtx) {
  for (const entry of LEGACY_INVENTORY) {
    const row = yield* Effect.promise(() => ctx.db.query(entry.table).first());
    if (row) {
      return yield* freezeFailure(
        `Legacy table ${entry.table} was repopulated after its drain.`
      );
    }
  }
});

export const freezeProgram = Effect.fn("contentRelease.cutover.freeze")(
  function* (ctx: MutationCtx, plan: RetainedTryoutHistoryPlan) {
    const cutover = yield* requireCutoverPhase(ctx, [
      "freeze-armed",
      "frozen",
      "draining-current",
      "complete",
      "proved",
    ]);
    if (cutover.phase !== "freeze-armed") {
      return yield* proveFrozenState(ctx, plan);
    }
    const state = yield* verifyAuditedPointer(ctx, cutover);
    const proof = yield* proveFreezeHistory(ctx, plan).pipe(
      Effect.mapError((error) => freezeError(error.message))
    );
    yield* validateHistoryProof(proof, plan);
    yield* Effect.promise(() => ctx.db.delete("contentState", state._id));
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", cutover._id, {
        frozenAt: now,
        phase: "frozen",
        updatedAt: now,
      })
    );
    return freezeReceipt(proof);
  }
);

/** Proves no publication changed or occupied a slot after initial audit. */
const verifyAuditedPointer = Effect.fn(
  "contentRelease.cutover.verifyAuditedPointer"
)(function* (
  ctx: MutationCtx,
  cutover: {
    readonly auditedActiveReleaseId: string;
    readonly auditedActiveSequence: number;
    readonly auditedNextSequence: number;
  }
) {
  const facts = yield* readAuditFacts(ctx);
  yield* validateQuiescentPublication(facts).pipe(
    Effect.mapError((error) => freezeError(error.message))
  );
  const state = yield* Effect.promise(() =>
    ctx.db
      .query("contentState")
      .withIndex("by_key", (index) => index.eq("key", "primary"))
      .unique()
  );
  if (
    !state ||
    state.activeReleaseId !== cutover.auditedActiveReleaseId ||
    state.activeSequence !== cutover.auditedActiveSequence ||
    state.nextSequence !== cutover.auditedNextSequence ||
    state.candidateReleaseId !== undefined ||
    state.recoveryReleaseId !== undefined
  ) {
    return yield* freezeFailure(
      "Publication singleton, candidate, or recovery state changed after audit."
    );
  }
  return state;
});

/** Re-proves idempotent retries cannot accept a recreated content pointer. */
const proveFrozenState = Effect.fn("contentRelease.cutover.proveFrozenState")(
  function* (ctx: MutationCtx, plan: RetainedTryoutHistoryPlan) {
    const state = yield* Effect.promise(() =>
      ctx.db.query("contentState").first()
    );
    if (state) {
      return yield* freezeFailure(
        "Publication state was recreated after the durable freeze."
      );
    }
    const proof = yield* proveRetainedHistoryComplete(ctx, plan).pipe(
      Effect.mapError((error) => freezeError(error.message))
    );
    yield* validateHistoryProof(proof, plan);
    return freezeReceipt(proof);
  }
);

/** Keeps the cross-module retention seam bound to exact Phase 1 counts. */
const validateHistoryProof = Effect.fn(
  "contentRelease.cutover.validateHistoryProof"
)(function* (
  proof: Omit<FreezeReceipt, "frozen">,
  plan: RetainedTryoutHistoryPlan
) {
  if (
    proof.attempts !== plan.attemptCount ||
    proof.catalogRows !== plan.catalogRowCount ||
    proof.frozenPlacements !== plan.frozenPlacementCount ||
    proof.markers !== plan.attemptCount ||
    proof.placementRows !== plan.placementRowCount ||
    proof.progressRows !== plan.progressCount ||
    proof.snapshotId !== plan.snapshotId
  ) {
    return yield* freezeFailure(
      "Immutable retained history differs from the production inventory."
    );
  }
});

/** Maps the history decoder seam to the publication cutover error contract. */
function freezeFailure(message: string) {
  return Effect.fail(freezeError(message));
}

function freezeError(message: string) {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: `Cutover freeze: ${message}`,
  });
}

function freezeReceipt(proof: Omit<FreezeReceipt, "frozen">): FreezeReceipt {
  return { ...proof, frozen: true };
}
