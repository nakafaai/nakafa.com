"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { useRouter } from "@repo/internationalization/src/navigation";
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { tryoutSetColumns } from "@/components/tryout/catalog/table/columns";
import { TryoutSetTablePager } from "@/components/tryout/catalog/table/pager";
import { readTryoutSetSort } from "@/components/tryout/catalog/table/sort";
import type {
  TryoutSetPagerValue,
  TryoutSetRow,
  TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

const PAGE_SIZE = 8;
const EMPTY_ROWS: TryoutSetRow[] = [];

/** Renders one realtime, server-sorted try-out set discovery table. */
export function TryoutSetTable({
  locale,
  page,
}: {
  locale: Locale;
  page: TryoutTrackPage;
}) {
  const router = useRouter();
  const tTryouts = useTranslations("Tryouts");
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const cursor = cursors[pageIndex] ?? null;
  const result = useQuery(api.tryouts.queries.sets.list, {
    countryKey: page.country.countryKey,
    examKey: page.exam.examKey,
    locale,
    paginationOpts: { cursor, numItems: PAGE_SIZE },
    sort: readTryoutSetSort(sorting),
    trackKey: page.track.trackKey,
  });
  // Convex returns undefined while changed sort or cursor arguments resolve.
  const [retainedResult, setRetainedResult] = useState(result);
  const visibleResult = result ?? retainedResult;

  function retainCurrentResult() {
    if (result) {
      setRetainedResult(result);
    }
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    retainCurrentResult();
    setSorting((current) => functionalUpdate(updater, current));
    setCursors([null]);
    setPageIndex(0);
  };

  // TanStack's supported React adapter intentionally owns this narrow state boundary.
  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns: tryoutSetColumns,
    data: visibleResult?.page ?? EMPTY_ROWS,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.setKey,
    manualPagination: true,
    manualSorting: true,
    onSortingChange: handleSortingChange,
    pageCount: visibleResult?.isDone ? pageIndex + 1 : -1,
    state: {
      pagination: { pageIndex, pageSize: PAGE_SIZE },
      sorting,
    },
  });

  if (!visibleResult) {
    return null;
  }

  const pager: TryoutSetPagerValue = {
    canNext: result !== undefined && !visibleResult.isDone,
    canPrevious: result !== undefined && pageIndex > 0,
    index: pageIndex,
    next: () => {
      if (!result || result.isDone) {
        return;
      }

      retainCurrentResult();
      setCursors((current) => [
        ...current.slice(0, pageIndex + 1),
        result.continueCursor,
      ]);
      setPageIndex((current) => current + 1);
    },
    previous: () => {
      if (!result || pageIndex === 0) {
        return;
      }

      retainCurrentResult();
      setPageIndex((current) => current - 1);
    },
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 py-6">
      <div
        aria-busy={result === undefined}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border"
      >
        <Table
          className="table-fixed"
          containerClassName="min-h-0 flex-1 content-start overflow-auto"
        >
          <TableHeader className="sticky top-0 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: `${header.getSize()}px` }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer"
                  key={row.id}
                  onClick={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest("a")
                    ) {
                      return;
                    }

                    router.push(
                      getTryoutPublicPathHref(row.original.publicPath)
                    );
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={table.getVisibleLeafColumns().length}
                >
                  {tTryouts("list-empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TryoutSetTablePager pager={pager} />
      </div>
    </div>
  );
}
