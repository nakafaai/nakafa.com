import {
  functionalUpdate,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext } from "react";

/**
 * A list the server sorts, filters by its `choice` columns and reads a window at a time, whose address holds the sort
 * (`sort`, none for the list's own order) and the chosen values (`chosen`). A `DataTable` shows them and hands a change
 * back (`onSort`, `choose`), and sorts and filters by them no further. The end of its rows reads the next window
 * (`more`, none once nothing more can be read) as it comes near, again for each answer the server gives (`snapshot`).
 */
export interface RemoteList {
  readonly choose: (column: string, value: string) => void;
  readonly chosen: Readonly<Record<string, string>>;
  readonly more: Option.Option<() => void>;
  readonly onSort: (column: string, descending: boolean) => void;
  readonly snapshot: string;
  readonly sort: Option.Option<{
    readonly column: string;
    readonly descending: boolean;
  }>;
}

/**
 * The values of a remote list's `choice` columns and the way to change one: a column's head reads its value here and
 * writes the change back, so the server reads the list again. A table whose server filters through the page's filters
 * has none.
 */
export const RemoteChoiceContext = createContext<
  Pick<RemoteList, "choose" | "chosen"> | undefined
>(undefined);

/**
 * How a `DataTable` sorts: a remote list shows the server's sort and hands a change of it back, so TanStack Table
 * sorts nothing itself, and any other list sorts the rows it holds as its heads choose.
 */
export function remoteSorting(list: RemoteList | undefined) {
  if (list === undefined) {
    return { options: {}, state: {} };
  }
  const sorting: SortingState = Option.match(list.sort, {
    onNone: () => [],
    onSome: ({ column, descending }) => [{ desc: descending, id: column }],
  });
  return {
    options: {
      manualSorting: true,
      onSortingChange: ((change) => {
        Option.map(Arr.head(functionalUpdate(change, sorting)), (next) =>
          list.onSort(next.id, next.desc)
        );
      }) satisfies OnChangeFn<SortingState>,
    },
    state: { sorting },
  };
}
