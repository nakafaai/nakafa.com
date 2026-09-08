"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { useTryoutSetData } from "@/components/tryout/catalog/table/data.client";
import { TryoutTableHeader } from "@/components/tryout/catalog/table/header";
import { catalogQuery } from "@/components/tryout/catalog/table/query";
import { TryoutTableRows } from "@/components/tryout/catalog/table/rows";
import type { TryoutCatalogBootstrap } from "@/components/tryout/catalog/table/types";

/** Displays one complete signed discovery result with independent URL controls. */
export function TryoutSetTable({
  bootstrap,
  title,
}: {
  bootstrap: TryoutCatalogBootstrap;
  title: string;
}) {
  const t = useTranslations("Tryouts");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [selection, setSelection] = useQueryStates(catalogQuery, {
    history: "push",
    shallow: true,
    scroll: false,
  });
  const sort = { field: selection.sort, direction: selection.direction };
  const { countryKey, examKey, locale, trackKey } = bootstrap.args;
  const data = useTryoutSetData({
    bootstrap,
    request: {
      countryKey,
      examKey,
      locale,
      trackKey,
      filter: selection.status,
      sort,
    },
  });
  let status = "";
  let emptyLabel = t("list-empty");
  if (data.busy) {
    status = t("set-updating");
    emptyLabel = status;
  }
  if (data.offline) {
    status = t("set-offline");
  }
  if (data.error) {
    status = t("set-update-error");
    emptyLabel = status;
  }

  const canLoadMore =
    data.hasMore && !data.busy && !data.error && !data.offline;
  return (
    <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-1 flex-col px-6 py-4">
      <div
        aria-busy={data.busy}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border"
        data-catalog-snapshot={data.snapshotId}
      >
        <div
          className="min-h-0 min-w-0 flex-1 overflow-auto"
          ref={setScrollRoot}
        >
          <Table
            className="min-w-176 table-fixed"
            containerClassName="overflow-visible"
          >
            <TableCaption className="sr-only">{title}</TableCaption>
            <colgroup>
              <col />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-28" />
            </colgroup>
            <TryoutTableHeader
              filter={selection.status}
              onFilter={async (status) => {
                await setSelection({ status });
              }}
              onSort={async ({ field, direction }) => {
                await setSelection({ sort: field, direction });
              }}
              sort={sort}
            />
            <TableBody>
              <TryoutTableRows emptyLabel={emptyLabel} rows={data.rows} />
              {canLoadMore && (
                <TableRow
                  aria-hidden="true"
                  className="h-px hover:bg-transparent"
                >
                  <TableCell className="p-0" colSpan={5}>
                    <Intersection
                      className="h-px"
                      key={`${selection.status}:${selection.sort}:${selection.direction}:${data.rows.length}`}
                      onIntersect={data.loadMore}
                      root={scrollRoot}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <span
          aria-live="polite"
          className="pointer-events-none absolute inset-x-4 bottom-3 text-muted-foreground text-xs empty:hidden"
          role="status"
        >
          {status}
        </span>
      </div>
    </div>
  );
}
