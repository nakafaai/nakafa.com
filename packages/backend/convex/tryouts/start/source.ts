import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { findReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/binding";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/convex/contentRelease/tryout/set";
import type { TryoutBundleSource } from "@repo/backend/convex/tryouts/runtime/bundle";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

/** Authenticated immutable snapshot rows used by attempt-owned projections. */
export interface TryoutSnapshotSource {
  readonly snapshot: VerifiedTryoutSet;
}

interface LegacyTryoutSource extends TryoutSnapshotSource {
  readonly bundle: TryoutBundleSource;
  readonly kind: "legacy";
}

interface PermanentTryoutSource extends TryoutSnapshotSource {
  readonly bundle: Doc<"tryoutRuntimeBundles">;
  readonly kind: "permanent";
  readonly releaseId: string;
}

/** Exact legacy or permanent source selected atomically for one new attempt. */
export type TryoutStartSource = LegacyTryoutSource | PermanentTryoutSource;

/** Loads the active signed snapshot through its explicit runtime binding. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (ctx: QueryCtx, args: StartAttemptArgs) {
  const owner = yield* loadTryoutOwner(ctx);
  const snapshot = yield* readTryoutSet(ctx, args);
  const { active, snapshotId } = owner;
  const runtime = yield* findReleaseTryoutRuntime(
    ctx,
    active.signed,
    active.release.tryoutRuntimeBundleHash
  );
  const selected = runtime.result;
  if (selected) {
    return {
      bundle: selected.stored,
      kind: "permanent",
      releaseId: active.releaseId,
      snapshot,
    } satisfies PermanentTryoutSource;
  }
  return {
    bundle: {
      manifestHash: active.manifestHash,
      releaseId: active.releaseId,
      releaseJson: active.release.releaseJson,
      rendererJson: active.release.rendererJson,
      snapshotId,
    },
    kind: "legacy",
    snapshot,
  } satisfies LegacyTryoutSource;
}, Effect.mapError(toTryoutStartError));
