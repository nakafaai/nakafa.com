import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  abortRowCount,
  deleteAbortRows,
  hasAbortResidue,
} from "@repo/backend/convex/contentRelease/abort/rows";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/convex/contentRelease/model";
import { Effect } from "effect";

/** Validates durable progress for one still-invisible abort operation. */
export const abortEvidence = Effect.fn("contentRelease.abortEvidence")(
  function* (release: {
    readonly abortedRows?: number;
    readonly abortingAt?: number;
    readonly checkedItems: number;
    readonly stagedItems: number;
    readonly stagedRoutes: number;
    readonly stagedSnapshotBatches: number;
    readonly status: string;
  }) {
    const processed = release.abortedRows ?? 0;
    const total = abortRowCount(release);
    if (
      release.status !== "aborting" ||
      release.abortingAt === undefined ||
      !Number.isSafeInteger(processed) ||
      processed < 0 ||
      processed >= total
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Aborting content release lost durable progress evidence."
      );
    }
  }
);

/** Proves one aborted release is terminal and detached from state. */
export const validateAbortedRelease = Effect.fn(
  "contentRelease.validateAbortedRelease"
)(function* (ctx: MutationCtx | QueryCtx, releaseId: string) {
  const release = yield* loadRelease(ctx, releaseId);
  const state = yield* loadState(ctx);
  const [rows, residue] = yield* Effect.all([
    Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("contentHeads")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", releaseId)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("snapshotBatches")
          .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
            query.eq("releaseId", releaseId)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("contentBindings")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", releaseId)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("contentItems")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", releaseId)
          )
          .first()
      ),
    ]),
    hasAbortResidue(ctx, releaseId, release.sequence),
  ]);
  if (
    release.status !== "aborted" ||
    release.abortedAt === undefined ||
    release.abortingAt === undefined ||
    release.abortedRows !== abortRowCount(release) ||
    state?.activeReleaseId === releaseId ||
    state?.candidateReleaseId === releaseId ||
    state?.recoveryReleaseId === releaseId ||
    residue ||
    rows.some((row) => row !== null)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Aborted release ${releaseId} retained publication state.`
    );
  }
  return release;
});

/** Abandons only an invisible candidate or retained recovery slot. */
export const abortProgram = Effect.fn("contentRelease.abort")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const release = yield* loadRelease(ctx, releaseId);
  if (release.status === "completed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Active release ${releaseId} cannot be aborted.`
    );
  }
  if (release.status === "aborted") {
    yield* validateAbortedRelease(ctx, releaseId);
    const total = abortRowCount(release);
    return {
      complete: true,
      processedItems: total,
      releaseId,
      totalItems: total,
    };
  }
  const state = yield* loadState(ctx);
  if (!(state && ownsRole(state, release.role, release))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Release ${releaseId} does not own an invisible slot.`
    );
  }
  if (release.role === "candidate" && state.recoveryReleaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Recovery ${state.recoveryReleaseId} must be aborted before candidate ${releaseId}.`
    );
  }
  if (release.status === "aborting") {
    yield* abortEvidence(release);
  }
  const total = abortRowCount(release);
  const before = release.abortedRows ?? 0;
  const deleted = yield* deleteAbortRows(ctx, releaseId, release.sequence);
  if (deleted === 0 && before < total) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} lost abort-owned rows before completion.`
    );
  }
  const processed = before + deleted;
  if (processed > total) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} abort exceeded its durable row count.`
    );
  }
  const complete = processed === total;
  if (complete && (yield* hasAbortResidue(ctx, releaseId, release.sequence))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} retained staged publication ownership.`
    );
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      abortedAt: complete ? now : undefined,
      abortedRows: processed,
      abortingAt: release.abortingAt ?? now,
      status: complete ? "aborted" : "aborting",
      updatedAt: now,
    })
  );
  if (complete) {
    const slot =
      release.role === "candidate"
        ? {
            candidateManifestHash: undefined,
            candidateReleaseId: undefined,
            candidateSequence: undefined,
          }
        : {
            recoveryManifestHash: undefined,
            recoveryReleaseId: undefined,
            recoverySequence: undefined,
          };
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, { ...slot, updatedAt: now })
    );
  }
  return { complete, processedItems: processed, releaseId, totalItems: total };
});
