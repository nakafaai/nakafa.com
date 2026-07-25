import { MAX_PLAIN_TEXT_BYTES } from "@nakafa/aksara-contracts/limits";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { getDocumentSize, type Value } from "convex/values";
import { Effect } from "effect";

/** Application ceiling that leaves headroom below Convex's 1 MiB limit. */
export const CONTENT_DOCUMENT_LIMIT = 512 * 1024;

/** Compact head ceiling used to prove bounded inventory pagination. */
export const HEAD_DOCUMENT_LIMIT = 16 * 1024;

/** Search-row ceiling that keeps a 32-hit scan below transaction budgets. */
export const SEARCH_DOCUMENT_LIMIT = 2 * MAX_PLAIN_TEXT_BYTES;

/** Removes optional fields exactly as Convex does before size accounting. */
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

/** Rejects a complete stored document before its database write. */
export const ensureDocumentSize = Effect.fn(
  "contentRelease.ensureDocumentSize"
)(function* (
  label: string,
  document: Readonly<Record<string, Value | undefined>>,
  limit = CONTENT_DOCUMENT_LIMIT
) {
  if (getDocumentSize(compactDocument(document)) >= limit) {
    return yield* releaseFail(
      "CONTENT_RELEASE_SIZE",
      `${label} exceeds the content document ceiling.`
    );
  }
});
