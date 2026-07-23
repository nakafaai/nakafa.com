import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/convex/contentRelease/model";
import { retainOrphanedArtifacts } from "@repo/backend/convex/contentRelease/retention";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Counts the release-owned rows that an abort must make unreachable. */
function abortTotal(release: {
  readonly checkedItems: number;
  readonly stagedItems: number;
  readonly stagedRoutes: number;
}) {
  return release.checkedItems + release.stagedItems + release.stagedRoutes;
}

/** Validates durable progress for one still-invisible abort operation. */
export const abortEvidence = Effect.fn("contentRelease.abortEvidence")(
  function* (release: {
    readonly abortedRows?: number;
    readonly abortingAt?: number;
    readonly checkedItems: number;
    readonly stagedItems: number;
    readonly stagedRoutes: number;
    readonly status: string;
  }) {
    const processed = release.abortedRows ?? 0;
    const total = abortTotal(release);
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
  const rows = yield* Effect.all([
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
  ]);
  if (
    release.status !== "aborted" ||
    release.abortedAt === undefined ||
    release.abortingAt === undefined ||
    release.abortedRows !== abortTotal(release) ||
    state?.activeReleaseId === releaseId ||
    state?.candidateReleaseId === releaseId ||
    state?.recoveryReleaseId === releaseId ||
    rows.some((row) => row !== null)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Aborted release ${releaseId} retained publication state.`
    );
  }
  return release;
});

/** Deletes one bounded release-owned row page in deterministic table order. */
const deleteRows = Effect.fn("contentRelease.deleteAbortRows")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const heads = yield* Effect.promise(() =>
    ctx.db
      .query("contentHeads")
      .withIndex("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId)
      )
      .take(RELEASE_PAGE_LIMIT)
  );
  let remaining = RELEASE_PAGE_LIMIT - heads.length;
  const bindings =
    remaining === 0
      ? []
      : yield* Effect.promise(() =>
          ctx.db
            .query("contentBindings")
            .withIndex("by_releaseId_and_index", (query) =>
              query.eq("releaseId", releaseId)
            )
            .take(remaining)
        );
  remaining -= bindings.length;
  const items =
    remaining === 0
      ? []
      : yield* Effect.promise(() =>
          ctx.db
            .query("contentItems")
            .withIndex("by_releaseId_and_index", (query) =>
              query.eq("releaseId", releaseId)
            )
            .take(remaining)
        );
  yield* Effect.forEach(heads, (row) =>
    Effect.promise(() => ctx.db.delete("contentHeads", row._id))
  );
  yield* Effect.forEach(bindings, (row) =>
    Effect.promise(() => ctx.db.delete("contentBindings", row._id))
  );
  yield* Effect.forEach(items, (row) =>
    Effect.promise(() => ctx.db.delete("contentItems", row._id))
  );
  yield* retainOrphanedArtifacts(
    ctx,
    [...heads, ...items].flatMap(({ artifactHash }) =>
      artifactHash === undefined ? [] : [artifactHash]
    )
  );
  return heads.length + bindings.length + items.length;
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
    const total = abortTotal(release);
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
  const total = abortTotal(release);
  const before = release.abortedRows ?? 0;
  const deleted = yield* deleteRows(ctx, releaseId);
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
