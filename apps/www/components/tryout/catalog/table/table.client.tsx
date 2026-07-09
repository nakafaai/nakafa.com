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
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { tryoutSetColumns } from "@/components/tryout/catalog/table/columns";
import { TryoutSetTablePager } from "@/components/tryout/catalog/table/pager";
import { readTryoutSetSort } from "@/components/tryout/catalog/table/sort";
import { TryoutSetTableToolbar } from "@/components/tryout/catalog/table/toolbar";
import type {
  TryoutSetPagerValue,
  TryoutSetRow,
  TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";

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
  const tTryouts = useTranslations("Tryouts");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((current) => functionalUpdate(updater, current));
    setCursors([null]);
    setPageIndex(0);
  };

  // TanStack's supported React adapter intentionally owns this narrow state boundary.
  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns: tryoutSetColumns,
    data: result?.page ?? EMPTY_ROWS,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.setKey,
    manualPagination: true,
    manualSorting: true,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: handleSortingChange,
    pageCount: result?.isDone ? pageIndex + 1 : -1,
    state: {
      columnVisibility,
      pagination: { pageIndex, pageSize: PAGE_SIZE },
      sorting,
    },
  });

  if (!result) {
    return null;
  }

  const pager: TryoutSetPagerValue = {
    canNext: !result.isDone,
    canPrevious: pageIndex > 0,
    index: pageIndex,
    next: () => {
      if (result.isDone) {
        return;
      }

      setCursors((current) => [
        ...current.slice(0, pageIndex + 1),
        result.continueCursor,
      ]);
      setPageIndex((current) => current + 1);
    },
    previous: () => {
      if (pageIndex === 0) {
        return;
      }

      setPageIndex((current) => current - 1);
    },
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-6">
      <div className="flex flex-col gap-4">
        <TryoutSetTableToolbar table={table} />
        <div className="overflow-hidden rounded-md border">
          <Table className="table-fixed">
            <TableHeader>
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
                  <TableRow key={row.id}>
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
        </div>
        <TryoutSetTablePager pager={pager} />
      </div>
    </div>
  );
}
