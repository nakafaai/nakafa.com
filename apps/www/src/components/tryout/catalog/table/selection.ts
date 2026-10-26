import { createContext, use } from "react";
import type {
  TryoutSetSort,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";

/** The filter and the sort the table shows, how to change them, and the table's title. */
export const TryoutSetTableContext = createContext<{
  filter: TryoutSetStatusFilter;
  onFilter: (filter: TryoutSetStatusFilter) => void;
  onSort: (sort: TryoutSetSort) => void;
  sort: TryoutSetSort;
  title: string;
} | null>(null);

/** Reads the selection of the surrounding try-out set table. */
export function useTryoutSetTable() {
  const value = use(TryoutSetTableContext);
  if (value === null) {
    throw new Error("useTryoutSetTable must be used within TryoutSetTable");
  }
  return value;
}
