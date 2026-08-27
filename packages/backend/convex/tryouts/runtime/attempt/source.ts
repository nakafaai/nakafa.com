import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { findTryoutBundleByRelease } from "@repo/backend/convex/tryouts/runtime/bundle";
import {
  selectorIntegrity,
  TryoutSelectorReadError,
} from "@repo/backend/convex/tryouts/runtime/ownership";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

interface PermanentSource {
  readonly bundleHash: string;
  readonly kind: "permanent";
}

interface PredecessorSource {
  readonly bundleHash: undefined;
  readonly kind: "predecessor";
}

export type AttemptRuntimeSource = PermanentSource | PredecessorSource;

/** Resolves one attempt's current runtime generation during expansion. */
export const loadAttemptRuntimeSource = Effect.fn(
  "tryouts.selectors.loadAttemptRuntimeSource"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
  if (
    (attempt.tryoutBundleId === undefined) !==
    (attempt.tryoutBundleHash === undefined)
  ) {
    return yield* selectorIntegrity(
      "Signed try-out attempt has a partial runtime bundle identity."
    );
  }
  if (
    attempt.tryoutBundleId !== undefined &&
    attempt.tryoutBundleHash !== undefined
  ) {
    const bundleId = attempt.tryoutBundleId;
    const bundleHash = attempt.tryoutBundleHash;
    const stored = yield* readSource<Doc<"tryoutRuntimeBundles"> | null>(() =>
      ctx.db.get("tryoutRuntimeBundles", bundleId)
    );
    if (
      !stored ||
      stored.bundleHash !== bundleHash ||
      stored.snapshotId !== attempt.tryoutSnapshotId
    ) {
      return yield* selectorIntegrity(
        "Signed try-out attempt lost its permanent runtime bundle."
      );
    }
    return {
      bundleHash: stored.bundleHash,
      kind: "permanent",
    } satisfies PermanentSource;
  }
  const stored = yield* findTryoutBundleByRelease(
    ctx,
    attempt.snapshotReleaseId
  ).pipe(
    Effect.mapError((cause) =>
      selectorReadError("Unable to read the predecessor runtime bundle.", cause)
    )
  );
  if (!stored) {
    return null;
  }
  if (
    stored.releaseId !== attempt.snapshotReleaseId ||
    stored.snapshotId !== attempt.tryoutSnapshotId
  ) {
    return yield* selectorIntegrity(
      "Signed try-out attempt lost its predecessor runtime bundle."
    );
  }
  return {
    bundleHash: undefined,
    kind: "predecessor",
  } satisfies PredecessorSource;
});

/** Lifts one source read into the typed selector error channel. */
function readSource<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      selectorReadError("Unable to read the permanent runtime bundle.", cause),
    try: operation,
  });
}

/** Creates one precise source-read failure without exposing storage details. */
function selectorReadError(message: string, cause: unknown) {
  return new TryoutSelectorReadError({
    cause,
    code: "TRYOUT_SELECTOR_INTEGRITY",
    message,
  });
}
