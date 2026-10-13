/**
 * Whether a memory has ended: its end date is before `now`. Only a situation
 * has an end date, because Nina dates every situation and nothing else, so a
 * memory without one never ends. The daily job deletes the ended situations by
 * the same date, and search, the recall of a turn and the Memory page all judge
 * a memory by this one rule.
 *
 * It takes the moment as an argument, because a query never reads the clock.
 */
export function hasEnded(
  memory: { readonly validUntil?: number },
  now: number
) {
  return memory.validUntil !== undefined && memory.validUntil < now;
}
