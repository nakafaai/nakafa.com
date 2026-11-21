import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Array as Arr, DateTime, Option } from "effect";
import { useTimeZone } from "use-intl";
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
 * filter reads each moment's day as the row's clock shows it (`withinDays`). It stands in a module of its own, so a
 * table without a column of moments, as the try-out tables are, keeps the calendar out of its page's first JavaScript.
 */
export function HeadDays({ column }: { column: string }) {
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
