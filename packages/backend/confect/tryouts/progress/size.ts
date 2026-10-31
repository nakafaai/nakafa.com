import { TryoutProgressSizeError } from "@repo/backend/confect/tryouts/progress/spec";
import { getDocumentSize, type Value } from "convex/values";
import { Effect } from "effect";

/**
 * The most bytes one progress row may hold. A track's set list reads one row for every set, so a
 * compact row keeps that read small.
 */
const TRYOUT_PROGRESS_DOCUMENT_LIMIT = 2 * 1024;

/** Checks the stored-row ceiling a track's set list relies on. */
export function isTryoutProgressWithinReadBudget(
  document: Readonly<Record<string, Value>>
) {
  return getDocumentSize(document) < TRYOUT_PROGRESS_DOCUMENT_LIMIT;
}

/** Rejects a progress row before it outgrows the ceiling a track's set list relies on. */
export const ensureTryoutProgressWithinReadBudget = Effect.fn(
  "tryouts.progress.ensureWithinReadBudget"
)(function* (document: Readonly<Record<string, Value>>) {
  if (isTryoutProgressWithinReadBudget(document)) {
    return;
  }
  return yield* new TryoutProgressSizeError({
    code: "TRYOUT_PROGRESS_SIZE",
    message: "Try-out progress exceeds its read budget.",
  });
});
