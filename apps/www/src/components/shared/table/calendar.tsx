import { Calendar } from "@repo/design-system/components/ui/calendar";
import {
  getCalendarDayKey,
  parseCalendarDayKey,
} from "@repo/design-system/lib/calendar/day-key";
import { DateTime, Option } from "effect";
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
  const from = Option.flatMap(days, ([first]) => parseCalendarDayKey(first));
  const to = Option.flatMap(days, ([, last]) => parseCalendarDayKey(last));

  return (
    <Calendar
      {...Option.match(from, {
        onNone: () => ({}),
        onSome: (defaultMonth) => ({ defaultMonth }),
      })}
      mode="range"
      onSelect={(range) =>
        choose(
          column,
          range?.from === undefined
            ? []
            : dayRangeOf(
                getCalendarDayKey(range.from),
                getCalendarDayKey(range.to ?? range.from)
              )
        )
      }
      selected={{
        from: Option.getOrUndefined(from),
        to: Option.getOrUndefined(to),
      }}
    />
  );
}
