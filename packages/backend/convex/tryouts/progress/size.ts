import { TRYOUT_PROGRESS_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { getDocumentSize, type Value } from "convex/values";
import { Effect, Schema } from "effect";

/** A compact progress row would invalidate the signed-catalog read proof. */
export class TryoutProgressSizeError
  extends Schema.TaggedError<TryoutProgressSizeError>()(
    "TryoutProgressSizeError",
    {
      code: Schema.Literal("TRYOUT_PROGRESS_SIZE"),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: "TRYOUT_PROGRESS_SIZE";
  declare readonly message: string;
}

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
