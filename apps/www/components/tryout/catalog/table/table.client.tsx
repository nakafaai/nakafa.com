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
  type Header,
  type OnChangeFn,
  type SortingState,
  type Table as TanStackTable,
  useReactTable,
} from "@tanstack/react-table";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { createTryoutSetColumns } from "@/components/tryout/catalog/table/columns";
import { useTryoutSetData } from "@/components/tryout/catalog/table/data.client";
import { readTryoutSetStatusFilter } from "@/components/tryout/catalog/table/filter";
import { TryoutTableRows } from "@/components/tryout/catalog/table/rows";
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

    const warmed = prewarmData({
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

    if (warmed) {
      warmedPaths.current.add(pathKey);
    }
  }

  /** Navigates one row after warming its route and authenticated data. */
  function navigateToSet(row: TryoutSetRow) {
    markSetIntent(row);
    router.push(getTryoutPublicPathHref(row.publicPath));
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
        <div className="min-h-0 flex-1 overflow-auto" ref={setScrollRoot}>
          <Table
            className="min-w-136 table-fixed"
            containerClassName="overflow-visible"
          >
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
                      <TryoutTableHeaderContent header={header} />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <TryoutTableRows
                emptyLabel={tTryouts("list-empty")}
                navigation={{ intent: markSetIntent, navigate: navigateToSet }}
                table={table}
              />
              <TryoutTableLoader
                data={data}
                scrollRoot={scrollRoot}
                table={table}
              />
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/** Renders one concrete TanStack header or nothing for a placeholder. */
function TryoutTableHeaderContent({
  header,
}: {
  header: Header<TryoutSetRow, unknown>;
}) {
  if (header.isPlaceholder) {
    return null;
  }

  return flexRender(header.column.columnDef.header, header.getContext());
}

/** Renders the infinite-query sentinel until Convex exhausts the result set. */
function TryoutTableLoader({
  data,
  scrollRoot,
  table,
}: {
  data: ReturnType<typeof useTryoutSetData>;
  scrollRoot: HTMLDivElement | null;
  table: TanStackTable<TryoutSetRow>;
}) {
  if (data.exhausted) {
    return null;
  }

  return (
    <TableRow aria-hidden="true" className="h-px hover:bg-transparent">
      <TableCell className="p-0" colSpan={table.getVisibleLeafColumns().length}>
        <Intersection
          className="h-px"
          key={data.loadKey}
          onIntersect={data.loadMore}
          root={scrollRoot}
        />
      </TableCell>
    </TableRow>
  );
}

/** Return responsive widths for each stable try-out table column. */
function getColumnWidthClassName(columnId: string) {
  if (columnId === "title") {
    return "w-[30%] sm:w-[40%]";
  }

  if (columnId === "readyQuestionCount") {
    return "w-[16%]";
  }

  if (columnId === "publishedScore") {
    return "w-[16%]";
  }

  return "w-[38%] sm:w-[28%]";
}
