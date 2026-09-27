import type { Docs } from "@repo/backend/confect/_generated/docs";
import { findReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/binding";
import type { StartAttemptArgs } from "@repo/backend/confect/tryouts/start/spec";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/content/tryout/set";
import { Effect } from "effect";

/** Authenticated immutable snapshot rows used by attempt-owned projections. */
export interface TryoutSnapshotSource {
  readonly snapshot: VerifiedTryoutSet;
}
export interface TryoutStartSource extends TryoutSnapshotSource {
  readonly bundle: Docs["tryoutRuntimeBundles"];
  readonly releaseId: string;
}

/** Loads the active signed snapshot through its explicit runtime binding. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (args: StartAttemptArgs) {
  const owner = yield* loadTryoutOwner().pipe(Effect.provide(tryoutLayer));
  const snapshot = yield* readTryoutSet(args).pipe(Effect.provide(tryoutLayer));
  const { active } = owner;
  const runtime = yield* findReleaseTryoutRuntime(
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
});
