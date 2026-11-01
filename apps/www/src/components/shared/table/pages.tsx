import { PaginatedQueryResult } from "@confect/react";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { type ReactNode, useEffect, useEffectEvent } from "react";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { TableWaitingContext } from "@/components/shared/table/waiting";
import { LoadFailure } from "@/components/state/failure";

/**
 * A table read a page at a time, around the `DataTable` that draws it: the table stands from the first frame and its
 * rows fill in as they arrive, the next page loads as the end comes near, and a read that failed says so. A first page
 * that failed has nothing to show, so its failure takes the table's place, and a later one keeps the rows it has.
 */
export function TablePages<Item, Failure>({
  children,
  pageSize,
  pagination,
}: {
  children: ReactNode;
  pageSize: number;
  pagination: PaginatedQueryResult.Variants<Item, Failure>;
}) {
  const failed = PaginatedQueryResult.isFailure(pagination);
  if (failed && Arr.isReadonlyArrayEmpty(pagination.results)) {
    return <LoadFailure onRetry={reloadPage} />;
  }
  return (
    <TableWaitingContext
      value={
        PaginatedQueryResult.isLoading(pagination) ||
        PaginatedQueryResult.isCanLoadMore(pagination)
      }
    >
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {children}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <TableEnd onLoad={() => pagination.loadMore(pageSize)} />
      ) : null}
    </TableWaitingContext>
  );
}

/**
 * The end of a paged table: the next page loads as this comes near, or at once while a column sorts the rows, because a
 * sort needs every row.
 */
export function TableEnd({ onLoad }: { onLoad: () => void }) {
  const sorted = useTableFilters((state) => state.sorted);

  return sorted ? (
    <NextPage onLoad={onLoad} />
  ) : (
    <Intersection onIntersect={onLoad} />
  );
}

/** Reads the next page as soon as it can, wherever the end of the list stands. */
function NextPage({ onLoad }: { onLoad: () => void }) {
  const load = useEffectEvent(onLoad);

  useEffect(() => {
    load();
  }, []);

  return null;
}
