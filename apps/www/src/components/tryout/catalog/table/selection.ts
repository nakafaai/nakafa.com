import { useRequired } from "@repo/design-system/hooks/required";
import type { Option } from "effect";
import { createContext } from "react";
import type {
  TryoutSetLevelFilter,
  TryoutSetSort,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";

/** The status, the level and the sort the table shows, how to change them, and the set the address opens. */
export const TryoutSetTableContext = createContext<{
  filter: TryoutSetStatusFilter;
  level: TryoutSetLevelFilter;
  /** Closes the open set pane beside the table, returning to the track's address. */
  onClose: () => void;
  onFilter: (filter: TryoutSetStatusFilter) => void;
  onLevel: (level: TryoutSetLevelFilter) => void;
  onSort: (sort: TryoutSetSort) => void;
  /** The public path of the set whose pane the address opens beside the table. */
  shown: Option.Option<string>;
  sort: TryoutSetSort;
} | null>(null);

/** Reads the selection of the surrounding try-out set table. */
export function useTryoutSetTable() {
  return useRequired(TryoutSetTableContext, "useTryoutSetTable");
}
