import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

/**
 * Whether a set's row opens its pane beside the table: the learner has never started the set, so it has no page of
 * their own yet. A set with progress opens its own page, and a running attempt always has progress.
 */
export function isUnstartedSet(row: Pick<TryoutSetRow, "attemptStatus">) {
  return row.attemptStatus === null;
}
