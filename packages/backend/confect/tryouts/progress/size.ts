import { TRYOUT_PROGRESS_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { TryoutProgressSizeError } from "@repo/backend/confect/tryouts/progress/spec";
import { getDocumentSize, type Value } from "convex/values";
import { Effect } from "effect";

/** A compact progress row would invalidate the signed-catalog read proof. */

/** Checks the stored-row ceiling reserved by complete catalog hydration. */
export function isTryoutProgressWithinReadBudget(
  document: Readonly<Record<string, Value>>
) {
  return getDocumentSize(document) < TRYOUT_PROGRESS_DOCUMENT_LIMIT;
}

/** Rejects a progress row before it can invalidate catalog read budgeting. */
export const ensureTryoutProgressWithinReadBudget = Effect.fn(
  "tryouts.progress.ensureWithinReadBudget"
)(function* (document: Readonly<Record<string, Value>>) {
  if (isTryoutProgressWithinReadBudget(document)) {
    return;
  }
  return yield* new TryoutProgressSizeError({
    code: "TRYOUT_PROGRESS_SIZE",
    message: "Try-out progress exceeds the signed catalog read budget.",
  });
});
