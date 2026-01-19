import { isWithinTokenLimit } from "gpt-tokenizer";

/**
 * Default token limit for content processing
 */
export const DEFAULT_LIMIT = 24_000;

/**
 * Check if content is within token limit
 * @param params - Object containing content and optional limit
 * @param params.content - The content to check
 * @param params.limit - Optional token limit, defaults to DEFAULT_LIMIT
 * @returns The token count if within limit, or false if over limit
 */
export function isWithinLimit({
  content,
  limit = DEFAULT_LIMIT,
}: {
  content: string;
  limit?: number;
}): false | number {
  return isWithinTokenLimit(content, limit);
}
