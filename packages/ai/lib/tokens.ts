import { isWithinTokenLimit } from "gpt-tokenizer";

export const DEFAULT_LIMIT = 24_000;

export function isWithinLimit({
  content,
  limit = DEFAULT_LIMIT,
}: {
  content: string;
  limit?: number;
}): false | number {
  return isWithinTokenLimit(content, limit);
}
