import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { releaseSnapshotTransitionValidator } from "@repo/backend/confect/contentRelease/spec";

/** Snapshot transition facts the history cleaner reads for one family. */
type ReleaseSnapshotTransition = typeof releaseSnapshotTransitionValidator.Type;

/** Reachability facts stored beside one release so retirement never decodes it. */
type ReleaseReachability = Pick<
  Docs["contentReleases"],
  | "baseManifestHash"
  | "baseReleaseId"
  | "manifestHash"
  | "originKind"
  | "rendererManifestHash"
  | "snapshotTransitions"
>;

/** Keeps only the snapshot facts history retention reads. */
function snapshotTransition(
  state: SignedContentRelease["manifest"]["snapshots"]["program"]
): ReleaseSnapshotTransition {
  return {
    baseSnapshotId: state.baseSnapshotId,
    mode: state.mode,
    resultSnapshotId: state.resultSnapshotId,
  };
}

/**
 * Projects one signed release onto the stored reachability facts.
 *
 * History retention decides what must stay reachable from these stored facts
 * alone, so a content contract generation change can never strand the cleaner
 * that retires old history.
 */
export function releaseReachability(
  signed: SignedContentRelease
): ReleaseReachability {
  return {
    baseManifestHash: signed.manifest.baseManifestHash,
    baseReleaseId: signed.manifest.baseReleaseId,
    manifestHash: signed.manifestHash,
    originKind: signed.manifest.origin.kind,
    rendererManifestHash: signed.manifest.rendererManifestHash,
    snapshotTransitions: {
      program: snapshotTransition(signed.manifest.snapshots.program),
      quran: snapshotTransition(signed.manifest.snapshots.quran),
      tryout: snapshotTransition(signed.manifest.snapshots.tryout),
    },
  };
}
