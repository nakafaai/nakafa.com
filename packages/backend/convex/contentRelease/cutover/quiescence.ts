import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { requireAudioWorkflowCleanupCheckpoint } from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import {
  readAuditFacts,
  validateQuiescentPublication,
} from "@repo/backend/convex/contentRelease/cutover/facts";
import {
  AUDITED_ACTIVE_RELEASE_ID,
  CUTOVER_INVENTORY_VERSION,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import {
  loadCutoverState,
  requireCutoverPhase,
} from "@repo/backend/convex/contentRelease/cutover/state";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { loadRetainedTryoutInventory } from "@repo/backend/convex/tryouts/history/inventory";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

const phaseValidator = v.union(v.null(), cutoverPhaseValidator);

/** Reads only the durable cutover phase for action orchestration. */
export const phase = internalQuery({
  args: {},
  returns: phaseValidator,
  handler: (ctx) =>
    runConvexProgram(
      loadCutoverState(ctx).pipe(Effect.map((state) => state?.phase ?? null))
    ),
});

/** Reads the monotonic legacy-write token used by the preflight handshake. */
export const activity = internalQuery({
  args: {},
  returns: v.number(),
  handler: (ctx) => runConvexProgram(readLegacyWriteVersion(ctx)),
});

/** Creates the durable writer-quiescence checkpoint after read-only preflight. */
export const initialize = internalMutation({
  args: { legacyWriteVersion: v.number() },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(initializeProgram(ctx, args.legacyWriteVersion)),
});

/** Accepts the stable inventory only after all mutable writers are quiescent. */
export const acceptAudit = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => runConvexProgram(acceptAuditProgram(ctx)),
});

/** Initializes every retry counter with the audited production identity. */
export const initializeProgram = Effect.fn("contentRelease.cutover.initialize")(
  function* (ctx: MutationCtx, expectedLegacyWriteVersion: number) {
    if (
      !Number.isSafeInteger(expectedLegacyWriteVersion) ||
      expectedLegacyWriteVersion < 0
    ) {
      return yield* stateFailure("The legacy-write token is invalid.");
    }
    const existing = yield* loadCutoverState(ctx);
    if (existing) {
      if (existing.auditedLegacyWriteVersion !== expectedLegacyWriteVersion) {
        return yield* stateFailure(
          "The durable cutover was initialized from another legacy-write token."
        );
      }
      return null;
    }
    const activityRow = yield* loadLegacyWriteActivity(ctx);
    const legacyWriteVersion = activityRow?.version ?? 0;
    if (legacyWriteVersion !== expectedLegacyWriteVersion) {
      return yield* stateFailure(
        "A legacy writer committed after the production inventory audit."
      );
    }
    const facts = yield* verifyQuiescentInventory(ctx);
    const activeReleaseId = facts.activeReleaseId;
    const activeSequence = facts.activeSequence;
    const nextSequence = facts.nextSequence;
    if (
      activeReleaseId !== AUDITED_ACTIVE_RELEASE_ID ||
      activeSequence === undefined ||
      nextSequence === undefined
    ) {
      return yield* stateFailure(
        "The audited active publication pointer changed before initialization."
      );
    }
    const now = Date.now();
    if (!activityRow) {
      yield* Effect.promise(() =>
        ctx.db.insert("contentCutoverActivity", {
          key: "legacy",
          updatedAt: now,
          version: 0,
        })
      );
    }
    yield* Effect.promise(() =>
      ctx.db.insert("contentCutoverState", {
        auditedActiveReleaseId: activeReleaseId,
        auditedActiveSequence: activeSequence,
        auditedAt: now,
        auditedLegacyWriteVersion: legacyWriteVersion,
        auditedNextSequence: nextSequence,
        currentDeleted: 0,
        currentTableDeleted: 0,
        currentTableIndex: 0,
        currentTablePreserved: 0,
        inventoryVersion: CUTOVER_INVENTORY_VERSION,
        key: "phase1",
        legacyDeleted: 0,
        legacyTableDeleted: 0,
        legacyTableIndex: 0,
        phase: "quiescent",
        updatedAt: now,
      })
    );
    return null;
  }
);

/** Rechecks the exact pointer and retained runtime after writer quiescence. */
const acceptAuditProgram = Effect.fn("contentRelease.cutover.acceptAudit")(
  function* (ctx: MutationCtx) {
    const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
    yield* requireAudioWorkflowCleanupCheckpoint({
      audit: state.audioWorkflowAudit,
      auditedAt: state.audioWorkflowAuditedAt,
      cleanedAt: state.audioWorkflowCleanedAt,
    });
    const legacyWriteVersion = yield* readLegacyWriteVersion(ctx);
    if (legacyWriteVersion !== state.auditedLegacyWriteVersion) {
      return yield* stateFailure(
        "The legacy-write token changed after writer quiescence."
      );
    }
    yield* verifyQuiescentInventory(ctx);
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        auditedAt: now,
        phase: "audited",
        updatedAt: now,
      })
    );
    return null;
  }
);

/** Proves the production pointer and complete retained runtime are unchanged. */
const verifyQuiescentInventory = Effect.fn(
  "contentRelease.cutover.verifyQuiescentInventory"
)(function* (ctx: MutationCtx) {
  const facts = yield* readAuditFacts(ctx);
  yield* validateQuiescentPublication(facts);
  yield* loadRetainedTryoutInventory(ctx, retainedTryoutHistoryPlan).pipe(
    Effect.mapError(
      (error) =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Cutover state: ${error.message}`,
        })
    )
  );
  return facts;
});

/** Loads the singleton activity row inside one mutation transaction. */
const loadLegacyWriteActivity = Effect.fn(
  "contentRelease.cutover.loadLegacyWriteActivity"
)(function* (ctx: MutationCtx) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentCutoverActivity")
      .withIndex("by_key", (index) => index.eq("key", "legacy"))
      .unique()
  );
});

/** Projects the current token while treating the pristine state as zero. */
const readLegacyWriteVersion = Effect.fn(
  "contentRelease.cutover.readLegacyWriteVersion"
)(function* (ctx: Pick<MutationCtx | QueryCtx, "db">) {
  const activityRow = yield* Effect.promise(() =>
    ctx.db
      .query("contentCutoverActivity")
      .withIndex("by_key", (index) => index.eq("key", "legacy"))
      .unique()
  );
  return activityRow?.version ?? 0;
});

/** Creates one stable writer-quiescence failure. */
function stateFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_STATE",
    `Cutover writer quiescence: ${message}`
  );
}
