import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Equal } from "effect";

/** What one row of the transcript shows: its message, and whether it is the newest row. */
interface RowProps {
  last: boolean;
  loadMore: (() => void) | undefined;
  message: NinaMessage;
}

/**
 * Whether a row can keep what it renders for the next props. Agent builds the
 * message of a turn with several steps again on every batch, so the object
 * changes while the words do not. A row therefore compares its message by what
 * it says, and a settled row keeps its place while a newer one streams.
 */
export function sameRow(before: RowProps, after: RowProps) {
  return (
    before.last === after.last &&
    before.loadMore === after.loadMore &&
    Equal.equals(before.message, after.message)
  );
}
