import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/content/tryout/set";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { findReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/binding";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

/** Authenticated immutable snapshot rows used by attempt-owned projections. */
export interface TryoutSnapshotSource {
  readonly snapshot: VerifiedTryoutSet;
}

export interface TryoutStartSource extends TryoutSnapshotSource {
  readonly bundle: Doc<"tryoutRuntimeBundles">;
  readonly releaseId: string;
}

/** Loads the active signed snapshot through its explicit runtime binding. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (ctx: QueryCtx, args: StartAttemptArgs) {
  const owner = yield* loadTryoutOwner().pipe(
    Effect.provide(convexTryoutLayer(ctx))
  );
  const snapshot = yield* readTryoutSet(args).pipe(
    Effect.provide(convexTryoutLayer(ctx))
  );
  const { active } = owner;
  const runtime = yield* findReleaseTryoutRuntime(
    ctx,
    active.signed,
    active.release.tryoutRuntimeBundleHash
  );
  // The active non-null snapshot and exact runtime binding guarantee this result.
  const selected = yield* Effect.fromNullishOr(runtime.result).pipe(
    Effect.orDie
  );
  return {
    bundle: selected.stored,
    releaseId: active.releaseId,
    snapshot,
  } satisfies TryoutStartSource;
}, Effect.mapError(toTryoutStartError));
