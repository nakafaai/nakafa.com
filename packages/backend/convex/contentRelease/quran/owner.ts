import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { loadSnapshotOwner } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { Effect } from "effect";

/** Resolves Quran ownership while preserving the exact active release pin. */
export const loadQuranOwner = Effect.fn("contentRelease.loadQuranOwner")(
  function* (ctx: QueryCtx) {
    const owner = yield* loadSnapshotOwner(ctx, "quran");
    if (
      owner.active === null ||
      owner.snapshot === null ||
      owner.snapshotId === null
    ) {
      return {
        activeManifestHash: owner.active?.manifestHash ?? null,
        activeReleaseId: owner.active?.releaseId ?? null,
        managed: false,
        snapshotId: null,
        sourceRevision: null,
      };
    }
    return {
      activeManifestHash: owner.active.manifestHash,
      activeReleaseId: owner.active.releaseId,
      managed: true,
      snapshotId: owner.snapshotId,
      sourceRevision: readSourceRevision(owner.active),
    };
  }
);
