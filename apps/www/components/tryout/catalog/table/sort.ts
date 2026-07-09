import type { SortingState } from "@tanstack/react-table";
import type { TryoutSetListArgs } from "@/components/tryout/catalog/table/types";

const defaultSort: TryoutSetListArgs["sort"] = {
  direction: "asc",
  field: "order",
};

/** Maps controlled TanStack sorting into the indexed Convex sort contract. */
export function readTryoutSetSort(
  sorting: SortingState
): TryoutSetListArgs["sort"] {
  const primary = sorting.at(0);

  if (!primary) {
    return defaultSort;
  }

  const direction = primary.desc ? "desc" : "asc";

  switch (primary.id) {
    case "readyQuestionCount":
    case "title":
    case "visibleSectionCount":
      return { direction, field: primary.id };
    default:
      return defaultSort;
  }
}
