import type { ColumnFiltersState } from "@tanstack/react-table";
import type {
  TryoutSetAttemptStatus,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";

const defaultFilter: TryoutSetStatusFilter = "all";

/** Returns whether an unknown menu value is a supported table status filter. */
export function isTryoutSetStatusFilter(
  value: unknown
): value is TryoutSetStatusFilter {
  switch (value) {
    case "all":
    case "not-started":
    case "in-progress":
    case "completed":
    case "expired":
      return true;
    default:
      return false;
  }
}

/** Reads the exact workflow status selected in the TanStack column state. */
export function readTryoutSetStatusFilter(
  filters: ColumnFiltersState
): TryoutSetStatusFilter {
  const value = filters.find((filter) => filter.id === "attemptStatus")?.value;

  if (isTryoutSetStatusFilter(value)) {
    return value;
  }

  return defaultFilter;
}

/** Narrows a table filter to the statuses stored in try-out progress rows. */
export function readTryoutSetAttemptStatus(
  filter: TryoutSetStatusFilter
): TryoutSetAttemptStatus | null {
  switch (filter) {
    case "in-progress":
    case "completed":
    case "expired":
      return filter;
    default:
      return null;
  }
}
