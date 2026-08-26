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
        activeManifestHash: owner.active
          ? String(owner.active.manifestHash)
          : null,
        activeReleaseId: owner.active ? String(owner.active.releaseId) : null,
        managed: false,
        snapshotId: null,
        sourceOrigin: null,
        sourceRevision: null,
      };
    }
    const sourceOrigin = owner.active.signed.manifest.origin;
    const sourceRevision = readSourceRevision(owner.active);
    return {
      activeManifestHash: String(owner.active.manifestHash),
      activeReleaseId: String(owner.active.releaseId),
      managed: true,
      snapshotId: String(owner.snapshotId),
      sourceOrigin:
        sourceOrigin.kind === "git"
          ? { kind: sourceOrigin.kind, sha: String(sourceOrigin.sha) }
          : {
              kind: sourceOrigin.kind,
              releaseId: String(sourceOrigin.releaseId),
            },
      sourceRevision: sourceRevision ? String(sourceRevision) : null,
    };
  }
);
