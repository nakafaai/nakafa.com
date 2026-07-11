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
import { useRouter } from "@repo/internationalization/src/navigation";
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { tryoutSetColumns } from "@/components/tryout/catalog/table/columns";
import { useTryoutSetData } from "@/components/tryout/catalog/table/data.client";
import { readTryoutSetSort } from "@/components/tryout/catalog/table/sort";
import type {
  TryoutSetRow,
  TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";
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
  const tTryouts = useTranslations("Tryouts");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useTryoutSetData({
    locale,
    page,
    sort: readTryoutSetSort(sorting),
  });
  const [retainedRows, setRetainedRows] = useState<TryoutSetRow[]>(EMPTY_ROWS);
  const visibleRows = data.pending ? retainedRows : data.rows;

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setRetainedRows(visibleRows);
    setSorting((current) => functionalUpdate(updater, current));
  };

  // TanStack's supported React adapter intentionally owns this narrow state boundary.
  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns: tryoutSetColumns,
    data: visibleRows,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.setKey,
    manualSorting: true,
    onSortingChange: handleSortingChange,
    state: {
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
          <Table className="table-fixed" containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-10 bg-background">
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
