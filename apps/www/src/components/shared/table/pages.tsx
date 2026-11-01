import { PaginatedQueryResult } from "@confect/react";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { type ReactNode, useEffect, useEffectEvent } from "react";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { useNeedsEveryRow } from "@/components/shared/table/toolbar";
import { TableWaitingContext } from "@/components/shared/table/waiting";
import { LoadFailure } from "@/components/state/failure";

/** How many rows a page of the rest of a list holds, once the page needs every row: a school's list holds thousands. */
const REST_PAGE = 50;

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
        <TableEnd
          onLoad={() => pagination.loadMore(pageSize)}
          onLoadRest={() => pagination.loadMore(Math.max(pageSize, REST_PAGE))}
        />
      ) : null}
    </TableWaitingContext>
  );
}

/**
 * The end of a paged table: the next page loads as this comes near, or at once while the page shows a choice that only
 * every row can answer, in bigger pages where the table reads them by `onLoadRest`.
 */
export function TableEnd({
  onLoad,
  onLoadRest = onLoad,
}: {
  onLoad: () => void;
  onLoadRest?: () => void;
}) {
  const needsEveryRow = useNeedsEveryRow();
  const loadRest = useEffectEvent(onLoadRest);

  useEffect(() => {
    if (needsEveryRow) {
      loadRest();
    }
  }, [needsEveryRow]);

  return needsEveryRow ? null : <Intersection onIntersect={onLoad} />;
}
