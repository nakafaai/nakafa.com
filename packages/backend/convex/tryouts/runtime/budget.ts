import { TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { getDocumentSize, type Value } from "convex/values";

/** Removes optional values before applying Convex document-size accounting. */
function compactDocument(
  document: Readonly<Record<string, Value | undefined>>
) {
  const compact: Record<string, Value> = {};
  for (const [key, value] of Object.entries(document)) {
    if (value !== undefined) {
      compact[key] = value;
    }
  }
  return compact;
}

/** Preserves the aggregate read and write budget for one frozen placement. */
export function isAttemptPlacementWithinBudget(
  document: Readonly<Record<string, Value | undefined>>
) {
  return (
    getDocumentSize(compactDocument(document)) <
    TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT
  );
}
