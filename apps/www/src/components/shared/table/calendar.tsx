import { Calendar } from "@repo/design-system/components/ui/calendar";
import type { AccessorFn, RowData } from "@tanstack/react-table";
import { Array as Arr, DateTime, Option } from "effect";
import { useTimeZone } from "use-intl";
import type { DaysSpec } from "@/components/shared/table/columns";
import { daysColumn, tableColumns } from "@/components/shared/table/columns";
import { chosenDays, dayRangeOf } from "@/components/shared/table/days";
import { useTableFilters } from "@/components/shared/table/toolbar";

/**
 * The clock that `format.dateTime` prints a moment by when a cell names no other, as a column of moments reads it: the
 * page's own, or the device's on a page without one.
 */
export function useFormatTimeZone() {
  const timeZone = useTimeZone();
  return () => timeZone ?? DateTime.zoneToString(DateTime.zoneMakeLocal());
}

/**
 * The calendar of a column of moments, whose range of days the page's filters hold under the column's ID. The column's
 * filter reads each moment's day as the row's clock shows it (`withinDays`). A column of moments carries it
 * (`datedColumns`), so a table without one, as the try-out tables are, keeps the calendar out of its page's JavaScript.
 */
function HeadDays({ column }: { column: string }) {
  const all = useTableFilters((state) => state.chosen);
  const choose = useTableFilters((state) => state.choose);
  const days = chosenDays(all, column);
  const range = Option.map(days, ([first, last]): [string, string] => [
    first,
    last,
  ]);

  return (
    <Calendar
      className="w-full p-0 [--cell-size:--spacing(9)]"
      {...Option.match(range, {
        onNone: () => ({}),
        onSome: ([first]) => ({ defaultMonth: first.slice(0, 7) }),
      })}
      mode="range"
      // The first press filters its one day at once, as a filter answers every press; a second press stretches it to
      // the range between the two.
      onAnchorChange={(anchor) => {
        if (anchor !== null) {
          choose(column, dayRangeOf(anchor, anchor));
        }
      }}
      onValueChange={(chosen) => {
        const [first, last] = Arr.isArray(chosen) ? chosen : [];
        choose(
          column,
          first === undefined || last === undefined
            ? []
            : dayRangeOf(first, last)
        );
      }}
      value={Option.getOrNull(range)}
    />
  );
}

/**
 * Declares the columns of a table of `TData` that holds moments: every kind `tableColumns` declares, and a column of
 * moments, whose head filters a range of days on the calendar and sorts the rows by them.
 */
export const datedColumns = <TData extends RowData>() => ({
  ...tableColumns<TData>(),
  /** A column of moments, a row without one reading as nothing. */
  days: <TValue extends number | null>(
    read: AccessorFn<TData, TValue>,
    column: DaysSpec<TData, TValue>
  ) => daysColumn(read, column, HeadDays),
});
