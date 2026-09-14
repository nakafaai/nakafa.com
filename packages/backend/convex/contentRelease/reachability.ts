import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type {
  releaseSnapshotTransitionsValidator,
  releaseSnapshotTransitionValidator,
} from "@repo/backend/convex/contentRelease/spec";
import type { Infer } from "convex/values";

/** Snapshot transition facts the history cleaner reads for one family. */
export type ReleaseSnapshotTransition = Infer<
  typeof releaseSnapshotTransitionValidator
>;

/** Fixed per-family snapshot transitions stored beside one release. */
export type ReleaseSnapshotTransitions = Infer<
  typeof releaseSnapshotTransitionsValidator
>;

/** Reachability facts stored beside one release so retirement never decodes it. */
export interface ReleaseReachability {
  readonly baseManifestHash: string | null;
  readonly baseReleaseId: string | null;
  readonly manifestHash: string;
  readonly originKind: "git" | "rollback";
  readonly rendererManifestHash: string;
  readonly snapshotTransitions: ReleaseSnapshotTransitions;
}

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
