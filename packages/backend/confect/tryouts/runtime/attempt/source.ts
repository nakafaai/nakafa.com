import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  selectorIntegrity,
  TryoutSelectorReadError,
} from "@repo/backend/confect/tryouts/runtime/ownership";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

/** Resolves the permanent runtime bundle owned by one signed attempt. */
export const loadAttemptRuntimeBundle = Effect.fn(
  "tryouts.selectors.loadAttemptRuntimeBundle"
)(function* (ctx: QueryCtx, attempt: TryoutAttempt) {
  const bundleId = attempt.tryoutBundleId;
  const bundleHash = attempt.tryoutBundleHash;
  const stored = yield* DatabaseReader.make(databaseSchema, ctx.db)
    .table("tryoutRuntimeBundles")
    .get(bundleId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie,
      Effect.catchDefect((cause) =>
        Effect.fail(
          new TryoutSelectorReadError({
            cause,
            code: "TRYOUT_SELECTOR_INTEGRITY",
            message: "Unable to read the permanent runtime bundle.",
          })
        )
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
