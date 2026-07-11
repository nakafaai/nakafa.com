import type { SortingState } from "@tanstack/react-table";
import type { TryoutSetSort } from "@/components/tryout/catalog/table/types";

const defaultSort: TryoutSetSort = {
  direction: "asc",
  field: "order",
};

/** Maps controlled TanStack sorting into the indexed Convex sort contract. */
export function readTryoutSetSort(sorting: SortingState): TryoutSetSort {
  const primary = sorting.at(0);

  if (!primary) {
    return defaultSort;
  }

  const direction = primary.desc ? "desc" : "asc";

  switch (primary.id) {
    case "readyQuestionCount":
    case "title":
      return { direction, field: primary.id };
    default:
      return defaultSort;
  }
}
