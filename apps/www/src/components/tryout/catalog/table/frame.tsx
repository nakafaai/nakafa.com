import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { TryoutTableHeader } from "@/components/tryout/catalog/table/header";
import { TryoutTableRows } from "@/components/tryout/catalog/table/rows";
import { useTryoutSetTable } from "@/components/tryout/catalog/table/selection";
import type { TryoutSetData } from "@/components/tryout/catalog/table/types";

/**
 * The frame of the discovery table: its header, its rows, the trigger that loads
 * the next window and the status line. A visitor's and a learner's table render
 * this same frame, so the two variants keep one layout.
 */
export function TryoutSetFrame({ data }: { data: TryoutSetData }) {
  const { filter, sort, title } = useTryoutSetTable();
  const t = useTranslations("Tryouts");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
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
            <TryoutTableHeader />
            <TableBody>
              <TryoutTableRows emptyLabel={emptyLabel} rows={data.rows} />
              {canLoadMore && (
                <TableRow aria-hidden="true" className="h-px">
                  <TableCell className="p-0" colSpan={5}>
                    <Intersection
                      className="h-px"
                      key={`${filter}:${sort.field}:${sort.direction}:${data.rows.length}`}
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
