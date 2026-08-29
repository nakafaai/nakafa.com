import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { findReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/binding";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/convex/contentRelease/tryout/set";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
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
  const owner = yield* loadTryoutOwner(ctx);
  const snapshot = yield* readTryoutSet(ctx, args);
  const { active } = owner;
  const runtime = yield* findReleaseTryoutRuntime(
    ctx,
    active.signed,
    active.release.tryoutRuntimeBundleHash
  );
  const selected = runtime.result;
  if (!selected) {
    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.failed,
      message: "Active try-out content has no permanent runtime bundle.",
    });
  }
  return {
    bundle: selected.stored,
    releaseId: active.releaseId,
    snapshot,
  } satisfies TryoutStartSource;
}, Effect.mapError(toTryoutStartError));
