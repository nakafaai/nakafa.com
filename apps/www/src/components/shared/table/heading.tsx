import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Calendar03Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import type { Header, RowData } from "@tanstack/react-table";
import { Array as Arr, Match, Option } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  HeadAlignContext,
  headPlace,
  menuPlaceOf,
  placeOf,
} from "@/components/shared/table/align";
import { HeadDays } from "@/components/shared/table/calendar";
import { ColumnChoice, ColumnFilter } from "@/components/shared/table/column";
import type { HeadFilter } from "@/components/shared/table/columns";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableHeadButton } from "@/components/shared/table/head";
import {
  ColumnHead,
  HeadPanel,
  HeadRange,
  HeadReset,
  HeadSort,
  HeadText,
  useIsFiltered,
} from "@/components/shared/table/panel";
import { useTableFilters } from "@/components/shared/table/toolbar";

/** The arrow of a column's head while it sorts the rows each way. */
const sortIcons = { asc: ArrowUp02Icon, desc: ArrowDown02Icon };

/**
 * A column's head, in its place in the line: the button that opens what filters the column, or, over the row's menu, the
 * one column with nothing to filter by, a name that only a screen reader reads, so every head of the table is named.
 */
export function DataTableHead<TData extends RowData>({
  children,
  header,
  index,
}: {
  children: ReactNode;
  header: Header<typeof dataTableFeatures, TData>;
  index: number;
}) {
  const common = useTranslations("Common");
  const column = header.column;
  const {
    align,
    filter,
    phone,
    title = "",
    wide,
  } = column.columnDef.meta ?? {};
  const place = placeOf(index, align);

  if (header.isPlaceholder || filter === undefined) {
    return (
      <ColumnHead place={place} width="menu">
        <span className="sr-only">{common("menu-actions")}</span>
      </ColumnHead>
    );
  }
  return (
    <ColumnHead
      menu={menuPlaceOf(
        index,
        Option.getOrElse(
          Arr.findLastIndex(
            header.headerGroup?.headers ?? [],
            (head) => head.column.columnDef.meta?.filter !== undefined
          ),
          () => index
        )
      )}
      phone={phone}
      place={place}
      sorted={column.getCanSort() ? column.getIsSorted() || "none" : undefined}
      width={wide === true ? "wide" : filter.kind}
    >
      <HeadAlignContext value={headPlace[place]}>
        <HeadControl filter={filter} header={header} title={title}>
          {children}
        </HeadControl>
      </HeadAlignContext>
    </ColumnHead>
  );
}

/** What a head holds: a menu of the values a column holds, or the panel of a column of text, numbers or moments. */
function HeadControl<TData extends RowData>({
  children,
  filter,
  header,
  title,
}: {
  children: ReactNode;
  filter: HeadFilter;
  header: Header<typeof dataTableFeatures, TData>;
  title: string;
}) {
  const id = header.column.id;

  return Match.value(filter).pipe(
    Match.discriminatorsExhaustive("kind")({
      choice: ({ options }) => (
        <ColumnChoice column={id} options={options} title={title} />
      ),
      days: () => (
        <SortingHead header={header} kind="days" name={children}>
          <HeadDays column={id} />
        </SortingHead>
      ),
      number: () => (
        <SortingHead header={header} kind="number" name={children}>
          <HeadRange column={id} label={title} />
        </SortingHead>
      ),
      text: () => (
        <SortingHead header={header} kind="text" name={children}>
          <HeadText column={id} label={title} />
        </SortingHead>
      ),
      values: ({ options }) => (
        <ColumnFilter column={id} options={options} title={title} />
      ),
    })
  );
}

/**
 * The head of a column that sorts the rows: its button, which shows the way the rows sort or that the column filters
 * them, and the panel that sorts them each way above what filters the column (`children`).
 */
function SortingHead<TData extends RowData>({
  children,
  header,
  kind,
  name,
}: {
  children: ReactNode;
  header: Header<typeof dataTableFeatures, TData>;
  kind: ComponentProps<typeof HeadSort>["kind"];
  name: ReactNode;
}) {
  const column = header.column;
  const sorted = column.getIsSorted() || "none";
  const filtered = useIsFiltered(column.id);
  const markSorted = useTableFilters((state) => state.markSorted);
  const idle = kind === "days" ? Calendar03Icon : FilterIcon;

  return (
    <HeadPanel
      trigger={
        <TableHeadButton
          active={sorted !== "none" || filtered}
          icon={sorted === "none" ? idle : sortIcons[sorted]}
        >
          {name}
        </TableHeadButton>
      }
    >
      <HeadSort
        kind={kind}
        onSort={(descending) => {
          // A list the server sorts reads its own order, so only a sort of the rows in hand needs every row.
          if (!column.table.options.manualSorting) {
            markSorted();
          }
          column.toggleSorting(descending);
        }}
        sorted={sorted}
      />
      {children}
      <HeadReset column={column.id} />
    </HeadPanel>
  );
}
