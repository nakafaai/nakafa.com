import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  selectorIntegrity,
  TryoutSelectorReadError,
} from "@repo/backend/confect/tryouts/runtime/ownership";
import { Effect } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];

/** Resolves the permanent runtime bundle owned by one signed attempt. */
export const loadAttemptRuntimeBundle = Effect.fn(
  "tryouts.selectors.loadAttemptRuntimeBundle"
)(function* (attempt: TryoutAttempt) {
  const bundleId = attempt.tryoutBundleId;
  const bundleHash = attempt.tryoutBundleHash;
  const stored = yield* (yield* DatabaseReader)
    .table("tryoutRuntimeBundles")
    .get(bundleId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(
        (cause) =>
          new TryoutSelectorReadError({
            cause,
            code: "TRYOUT_SELECTOR_INTEGRITY",
            message: "Unable to read the permanent runtime bundle.",
          })
      )
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
