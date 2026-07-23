import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  abortEvidence,
  validateAbortedRelease,
} from "@repo/backend/convex/contentRelease/abort";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import {
  currentValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type ReleaseStatus = Infer<typeof statusValidator>;
type CurrentStatus = Infer<typeof currentValidator>;
type ActiveBundle = NonNullable<CurrentStatus["active"]>;
type StagedBundle = NonNullable<CurrentStatus["candidate"]>;

/** Validates and returns one invisible slot's public lifecycle phase. */
const stagedPhase = Effect.fn("contentRelease.stagedPhase")(function* (
  ctx: QueryCtx,
  release: Doc<"contentReleases">
) {
  const state = yield* loadState(ctx);
  if (!(state && ownsRole(state, release.role, release))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} lost its ${release.role} slot.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (
    signed.manifest.releaseId !== release.releaseId ||
    (release.role === "candidate" &&
      signed.manifestHash !== state.candidateManifestHash) ||
    (release.role === "recovery" &&
      signed.manifestHash !== state.recoveryManifestHash)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} lost its signed slot identity.`
    );
  }
  if (release.status === "aborting") {
    yield* abortEvidence(release);
    return "aborting";
  }
  if (
    release.status !== "staging" &&
    release.status !== "verifying" &&
    release.status !== "verified"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} has terminal state in an invisible slot.`
    );
  }
  yield* stagedEvidence(release, signed);
  return release.status;
});

/** Loads one exact stored bundle for an invisible candidate or recovery. */
const stagedBundle = Effect.fn("contentRelease.stagedBundle")(function* (
  ctx: QueryCtx,
  releaseId: string | undefined
) {
  if (releaseId === undefined) {
    return null;
  }
  const release = yield* loadRelease(ctx, releaseId);
  return {
    phase: yield* stagedPhase(ctx, release),
    releaseJson: release.releaseJson,
    rendererJson: release.rendererJson,
  } satisfies StagedBundle;
});

/** Loads the exact completed release selected by validated active state. */
const activeBundle = Effect.fn("contentRelease.activeBundle")(function* (
  ctx: QueryCtx
) {
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return null;
  }

  return {
    receipt: yield* completedReceipt(active.release, active.signed),
    releaseJson: active.release.releaseJson,
    rendererJson: active.release.rendererJson,
  } satisfies ActiveBundle;
});

/** Reads authenticated recovery bytes for the singleton publication state. */
const currentProgram = Effect.fn("contentRelease.current")(function* (
  ctx: QueryCtx
) {
  const state = yield* loadState(ctx);
  if (!state) {
    return {
      active: null,
      candidate: null,
      recovery: null,
    } satisfies CurrentStatus;
  }
  return {
    active: yield* activeBundle(ctx),
    candidate: yield* stagedBundle(ctx, state.candidateReleaseId),
    recovery: yield* stagedBundle(ctx, state.recoveryReleaseId),
  } satisfies CurrentStatus;
});

/** Reads one indexed release phase without exposing publication internals. */
const statusProgram = Effect.fn("contentRelease.status")(function* (
  ctx: QueryCtx,
  manifestHash: string,
  releaseId: string
) {
  const release = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
      .unique()
  );
  if (!release) {
    return {
      manifestHash,
      phase: "missing",
      releaseId,
    } satisfies ReleaseStatus;
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} was requested with another manifest.`
    );
  }
  if (release.status === "completed") {
    return {
      manifestHash,
      phase: "completed",
      receipt: yield* completedReceipt(release, signed),
      releaseId,
    } satisfies ReleaseStatus;
  }
  if (release.status === "aborted") {
    yield* validateAbortedRelease(ctx, releaseId);
    return {
      manifestHash,
      phase: "aborted",
      releaseId,
    } satisfies ReleaseStatus;
  }
  return {
    manifestHash,
    phase: yield* stagedPhase(ctx, release),
    releaseId,
  } satisfies ReleaseStatus;
});

/** Returns the exact internal lifecycle view used for crash-safe resume. */
export const getStatus = internalQuery({
  args: { manifestHash: v.string(), releaseId: v.string() },
  returns: statusValidator,
  handler: (ctx, args) =>
    runConvexProgram(statusProgram(ctx, args.manifestHash, args.releaseId)),
});

/** Returns authoritative active, candidate, and recovery release bundles. */
export const current = internalQuery({
  args: {},
  returns: currentValidator,
  handler: (ctx) => runConvexProgram(currentProgram(ctx)),
});
