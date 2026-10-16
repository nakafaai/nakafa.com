import { docsToModelMessages, type MessageDoc } from "@convex-dev/agent";

/**
 * The model messages of stored rows that are already opened. A row converts only
 * after it opens: a sealed row converts to its skeleton, which is harmless and
 * wrong (ADR 0024). Callers that hold opened rows use this, never the Agent's
 * conversion itself.
 */
export function toModelMessages(docs: MessageDoc[]) {
  return docsToModelMessages(docs);
}
