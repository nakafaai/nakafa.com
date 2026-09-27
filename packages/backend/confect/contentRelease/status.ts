import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  abortEvidence,
  validateAbortedRelease,
} from "@repo/backend/confect/contentRelease/abort";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { requireCurrentRelease } from "@repo/backend/confect/contentRelease/generation";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/confect/contentRelease/receipt";
import type {
  currentValidator,
  statusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { findReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/binding";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, type Schema } from "effect";
export type ReleaseStatus = Schema.Schema.Type<typeof statusValidator>;
export type CurrentStatus = Schema.Schema.Type<typeof currentValidator>;
export type ActiveBundle = NonNullable<CurrentStatus["active"]>;
export type StagedBundle = NonNullable<CurrentStatus["candidate"]>;

/** Validates and returns one invisible slot's public lifecycle phase. */
export const stagedPhase = Effect.fn("contentRelease.stagedPhase")(function* (
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
export const stagedBundle = Effect.fn("contentRelease.stagedBundle")(function* (
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

/** Loads the completed active release and its optional permanent runtime pair. */
export const activePublication = Effect.fn("contentRelease.activePublication")(
  function* (ctx: QueryCtx) {
    const active = yield* loadActiveIdentity().pipe(
      Effect.provide(convexPublicationLayer(ctx))
    );
    if (!active) {
      return null;
    }
    const runtime = yield* findReleaseTryoutRuntime(
      ctx,
      active.signed,
      active.release.tryoutRuntimeBundleHash
    );
    return {
      active: {
        receipt: yield* completedReceipt(active.release, active.signed),
        releaseJson: active.release.releaseJson,
        rendererJson: active.release.rendererJson,
      } satisfies ActiveBundle,
      tryoutRuntimeBundleJson: runtime.result?.stored.bundleJson ?? null,
    };
  }
);

/** Reads authenticated recovery bytes for the singleton publication state. */
export const currentProgram = Effect.fn("contentRelease.current")(function* (
  ctx: QueryCtx
) {
  const state = yield* loadState(ctx);
  if (!state) {
    return {
      active: null,
      candidate: null,
      recovery: null,
      tryoutRuntimeBundleJson: null,
    } satisfies CurrentStatus;
  }
  const publication = yield* activePublication(ctx);
  return {
    active: publication?.active ?? null,
    candidate: yield* stagedBundle(ctx, state.candidateReleaseId),
    recovery: yield* stagedBundle(ctx, state.recoveryReleaseId),
    tryoutRuntimeBundleJson: publication?.tryoutRuntimeBundleJson ?? null,
  } satisfies CurrentStatus;
});

/** Reads one indexed release phase without exposing publication internals. */
export const statusProgram = Effect.fn("contentRelease.status")(function* (
  ctx: QueryCtx,
  manifestHash: string,
  releaseId: string
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const release = yield* database
    .table("contentReleases")
    .get("by_releaseId", releaseId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!release) {
    return {
      manifestHash,
      phase: "missing",
      releaseId,
    } satisfies ReleaseStatus;
  }
  yield* requireCurrentRelease(release.releaseJson, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} was requested with another manifest.`
    );
  }
  if (release.status === "completed") {
    yield* findReleaseTryoutRuntime(
      ctx,
      signed,
      release.tryoutRuntimeBundleHash
    );
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
