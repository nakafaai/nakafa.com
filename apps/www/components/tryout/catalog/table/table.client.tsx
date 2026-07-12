"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import {
  type ColumnFiltersState,
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { createTryoutSetColumns } from "@/components/tryout/catalog/table/columns";
import { useTryoutSetData } from "@/components/tryout/catalog/table/data.client";
import { readTryoutSetStatusFilter } from "@/components/tryout/catalog/table/filter";
import { readTryoutSetSort } from "@/components/tryout/catalog/table/sort";
import type {
  TryoutSetRow,
  TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

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
  const prewarmData = useTryoutDataIntent();
  const tTryouts = useTranslations("Tryouts");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const warmedPaths = useRef(new Set<string>());
  const statusFilter = readTryoutSetStatusFilter(columnFilters);
  const columns = useMemo(
    () =>
      createTryoutSetColumns({
        sorting,
        statusFilter,
      }),
    [sorting, statusFilter]
  );
  const data = useTryoutSetData({
    locale,
    page,
    statusFilter,
    sort: readTryoutSetSort(sorting),
  });

  /** Prewarm a set after the viewer signals navigation intent. */
  function markSetIntent(row: TryoutSetRow) {
    const pathKey = `${locale}:${row.publicPath}`;

    if (warmedPaths.current.has(pathKey)) {
      return;
    }

    warmedPaths.current.add(pathKey);
    prewarmData({
      directEntry:
        row.internalEntrySectionKey && row.attemptStatus !== null
          ? {
              countryKey: row.countryKey,
              examKey: row.examKey,
              sectionKey: row.internalEntrySectionKey,
              setKey: row.setKey,
              trackKey: row.trackKey,
            }
          : null,
      kind: "set",
      locale,
      publicPath: row.publicPath,
    });
  }
  const [retainedRows, setRetainedRows] = useState<TryoutSetRow[]>(EMPTY_ROWS);
  const visibleRows = data.pending ? retainedRows : data.rows;

  /** Retain visible rows while requesting a newly sorted server page. */
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setRetainedRows(visibleRows);
    setColumnFilters([]);
    setSorting((current) => functionalUpdate(updater, current));
  };

  /** Retain visible rows while requesting a newly filtered server page. */
  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
    updater
  ) => {
    setRetainedRows(visibleRows);
    setSorting([]);
    setColumnFilters((current) => functionalUpdate(updater, current));
  };

  // TanStack's supported React adapter intentionally owns this narrow state boundary.
  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data: visibleRows,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.setKey,
    manualFiltering: true,
    manualSorting: true,
    onColumnFiltersChange: handleColumnFiltersChange,
    onSortingChange: handleSortingChange,
    state: {
      columnFilters,
      sorting,
    },
  });

  if (data.pending && visibleRows.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 py-4">
      <div
        aria-busy={data.busy}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border"
      >
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          ref={setScrollRoot}
        >
          <Table className="table-fixed" containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className={cn(
                        "px-2 sm:px-4",
                        getColumnWidthClassName(header.column.id)
                      )}
                      key={header.id}
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
                    onFocusCapture={() => markSetIntent(row.original)}
                    onMouseEnter={() => markSetIntent(row.original)}
                    onTouchStart={() => markSetIntent(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell className="px-2 sm:px-4" key={cell.id}>
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
              {data.exhausted ? null : (
                <TableRow
                  aria-hidden="true"
                  className="h-px hover:bg-transparent"
                >
                  <TableCell
                    className="p-0"
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    <Intersection
                      className="h-px"
                      key={data.loadKey}
                      onIntersect={data.loadMore}
                      root={scrollRoot}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/** Return responsive widths for each stable try-out table column. */
function getColumnWidthClassName(columnId: string) {
  if (columnId === "title") {
    return "w-[44%] sm:w-1/2";
  }

  if (columnId === "readyQuestionCount") {
    return "w-[22%] sm:w-1/5";
  }

  return "w-[34%] sm:w-[30%]";
}
