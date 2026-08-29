import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  selectorIntegrity,
  TryoutSelectorReadError,
} from "@repo/backend/convex/tryouts/runtime/ownership";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

/** Resolves the permanent runtime bundle owned by one signed attempt. */
export const loadAttemptRuntimeBundle = Effect.fn(
  "tryouts.selectors.loadAttemptRuntimeBundle"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
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
  return stored;
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
