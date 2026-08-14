import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { requireAudioWorkflowCleanupCheckpoint } from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import {
  readAuditFacts,
  validateQuiescentPublication,
} from "@repo/backend/convex/contentRelease/cutover/facts";
import { requireRetiredProgramZeroReceipt } from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
import { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import {
  loadCutoverState,
  requireCutoverPhase,
  requireLegacyWriteCheckpoint,
  requireReaderCutoverCheckpoint,
} from "@repo/backend/convex/contentRelease/cutover/state";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
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

/** Accepts the stable inventory only after all mutable writers are quiescent. */
export const acceptAudit = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => runConvexProgram(acceptAuditProgram(ctx)),
});

/** Rechecks the exact pointer and retained runtime after writer quiescence. */
const acceptAuditProgram = Effect.fn("contentRelease.cutover.acceptAudit")(
  function* (ctx: MutationCtx) {
    const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
    yield* requireRetiredProgramZeroReceipt(state.retiredProgramZeroReceipt);
    yield* requireAudioWorkflowCleanupCheckpoint({
      audit: state.audioWorkflowAudit,
      auditedAt: state.audioWorkflowAuditedAt,
      cleanedAt: state.audioWorkflowCleanedAt,
    });
    yield* requireReaderCutoverCheckpoint(state);
    yield* requireLegacyWriteCheckpoint(ctx, state);
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

/** Proves the production pointer remains equal to the accepted audit. */
const verifyQuiescentInventory = Effect.fn(
  "contentRelease.cutover.verifyQuiescentInventory"
)(function* (ctx: MutationCtx) {
  const facts = yield* readAuditFacts(ctx);
  yield* validateQuiescentPublication(facts);
  return facts;
});
