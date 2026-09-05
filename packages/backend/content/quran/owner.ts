import { loadSnapshotOwner } from "@repo/backend/content/snapshot/read";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Resolves Quran ownership while preserving the exact active release pin. */
export const loadQuranOwner = Effect.fn("contentRelease.loadQuranOwner")(
  function* () {
    const owner = yield* loadSnapshotOwner("quran");
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
