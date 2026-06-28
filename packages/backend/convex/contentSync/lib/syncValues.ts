import { Struct } from "effect";

type SyncComparableValue = boolean | number | string | undefined;
type SyncComparableValues = Record<string, SyncComparableValue>;

/**
 * Checks whether a stored row already matches every derived sync field.
 *
 * Keeping the comparison keyed from `nextValues` makes the sync contract harder
 * to accidentally desynchronize when runtime-rendered metadata changes.
 */
export function hasSameSyncValues<const TValues extends SyncComparableValues>(
  nextValues: TValues,
  existing: Partial<TValues> | null | undefined
) {
  if (!existing) {
    return false;
  }

  return Struct.entries(nextValues).every(
    ([field, nextValue]) => existing[field] === nextValue
  );
}
