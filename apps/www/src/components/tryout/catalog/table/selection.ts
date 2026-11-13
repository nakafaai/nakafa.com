import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import type {
  TryoutSetSort,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";

/** The filter and the sort the table shows, and how to change them. */
export const TryoutSetTableContext = createContext<{
  filter: TryoutSetStatusFilter;
  onFilter: (filter: TryoutSetStatusFilter) => void;
  onSort: (sort: TryoutSetSort) => void;
  sort: TryoutSetSort;
} | null>(null);

/** Reads the selection of the surrounding try-out set table. */
export function useTryoutSetTable() {
  return useRequired(TryoutSetTableContext, "useTryoutSetTable");
}
