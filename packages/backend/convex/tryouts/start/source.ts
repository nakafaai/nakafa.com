import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/convex/contentRelease/tryout/set";
import type { TryoutBundleSource } from "@repo/backend/convex/tryouts/runtime/bundle";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

/** Authenticated immutable rows used to create one attempt. */
export interface TryoutStartSource {
  readonly bundle: TryoutBundleSource;
  readonly snapshot: VerifiedTryoutSet;
}

/** Loads the complete signed snapshot without cross-source joins. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (ctx: QueryCtx, args: StartAttemptArgs) {
  const owner = yield* loadTryoutOwner(ctx).pipe(
    Effect.mapError(toTryoutStartError)
  );
  const snapshot = yield* readTryoutSet(ctx, args).pipe(
    Effect.mapError(toTryoutStartError)
  );
  const { active, snapshotId } = owner;
  const source: TryoutStartSource = {
    bundle: {
      manifestHash: active.manifestHash,
      releaseId: active.releaseId,
      releaseJson: active.release.releaseJson,
      rendererJson: active.release.rendererJson,
      snapshotId,
    },
    snapshot,
  };
  return source;
});
