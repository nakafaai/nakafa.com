import {
  setFilterValidator,
  setSortValidator,
} from "@repo/backend/confect/tryouts/sets/query";
import { Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { Panes, PanesDetail, PanesList } from "@/components/shared/panes";
import { DataTable } from "@/components/shared/table/data";
import { TablePageBody } from "@/components/shared/table/frame";
import { useTryoutSetColumns } from "@/components/tryout/catalog/table/columns";
import { TryoutSetPane } from "@/components/tryout/catalog/table/pane";
import { useTryoutSetTable } from "@/components/tryout/catalog/table/selection";
import { isUnstartedSet } from "@/components/tryout/catalog/table/started";
import type { TryoutSetData } from "@/components/tryout/catalog/table/types";

/**
 * The discovery table of a track: a `DataTable` the server sorts, filters by status and reads a window at a time. A
 * visitor's and a learner's table render this same frame, so the two variants keep one layout. The address holds the
 * status and the sort, the heads of the name and the figures keep the sets the table has read, and the next window
 * loads as the end of the rows comes into view, so a filter reaches the whole track. The status line says when the
 * rows are updating, offline, or could not update.
 */
export function TryoutSetFrame({ data }: { data: TryoutSetData }) {
  const { filter, onFilter, onSort, sort } = useTryoutSetTable();
  const t = useTranslations("Tryouts");
  const columns = useTryoutSetColumns();
  const status = Option.match(
    Option.firstSomeOf([
      Option.liftPredicate("set-update-error" as const, () => data.error),
      Option.liftPredicate("set-offline" as const, () => data.offline),
      Option.liftPredicate("set-updating" as const, () => data.busy),
    ]),
    { onNone: () => "", onSome: (key) => t(key) }
  );
  const canLoadMore =
    data.hasMore && !data.busy && !data.error && !data.offline;

  return (
    <Panes fill="parent" id="tryout-sets">
      <PanesList>
        <TablePageBody>
          {/* The rows every visitor reads hide a learner's progress marks under a signed-in hint. */}
          <div
            className="contents"
            data-catalog-snapshot={data.snapshotId}
            data-rows={data.shared ? "shared" : undefined}
          >
            <DataTable
              columns={columns}
              data={data.rows}
              loading={data.busy}
              opens={isUnstartedSet}
              rowId={(row) => row.publicPath}
              server={{
                choose: (_column, value) => {
                  if (Schema.is(setFilterValidator)(value)) {
                    onFilter(value);
                  }
                },
                chosen: { status: filter },
                more: canLoadMore ? Option.some(data.loadMore) : Option.none(),
                onSort: (column, descending) => {
                  if (Schema.is(setSortValidator.fields.field)(column)) {
                    onSort({
                      direction: descending ? "desc" : "asc",
                      field: column,
                    });
                  }
                },
                snapshot: `${filter}:${sort.field}:${sort.direction}:${data.snapshotId ?? ""}`,
                sort:
                  sort.field === "order"
                    ? Option.none()
                    : Option.some({
                        column: sort.field,
                        descending: sort.direction === "desc",
                      }),
              }}
            />
          </div>
          <span aria-live="polite" className="sr-only" role="status">
            {status}
          </span>
        </TablePageBody>
      </PanesList>
      <PanesDetail label={t("set-pane")}>
        <TryoutSetPane rows={data.rows} />
      </PanesDetail>
    </Panes>
  );
}
