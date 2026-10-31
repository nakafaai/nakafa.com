import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  getCalendarDayKey,
  parseCalendarDayKey,
} from "@repo/design-system/lib/calendar/day-key";
import type { Column, RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import { Option } from "effect";
import type { ComponentProps, ReactElement } from "react";
import { useTranslations } from "use-intl";
import { chosenDays, dayRangeOf } from "@/components/shared/table/days";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { useTableFilters } from "@/components/shared/table/toolbar";

/**
 * Where a head's button stands in its line: pulled to the cell's start edge in the first column, so the column's name
 * lines up with the rows below it, and pulled to both edges in a centred column. An active head, one that sorts or
 * filters the rows, takes the muted fill.
 */
const headButton = cva(
  "max-w-[calc(100%+1rem)] min-w-0 overflow-hidden sm:max-w-[calc(100%+1.75rem)]",
  {
    defaultVariants: { active: false, align: "center" },
    variants: {
      active: { false: "", true: "bg-muted text-foreground" },
      align: { center: "-mx-2 sm:-mx-3", start: "-ml-2 sm:-ml-3" },
    },
  }
);

/**
 * The button in a table's column head that opens the column's menu, to sort the rows by it or to filter them: the
 * column's name, cut short when the column is narrow, and the menu's icon after it. Every table of Nakafa draws its
 * heads with it, the try-out tables and the School's data tables alike, so a head reads and behaves the same
 * everywhere.
 */
export function TableHeadButton({
  active = false,
  align = "center",
  children,
  icon,
  ...props
}: Omit<ComponentProps<typeof Button>, "className" | "size" | "variant"> & {
  readonly active?: boolean;
  readonly align?: "center" | "start";
  readonly icon: IconSvgElement;
}) {
  return (
    <Button
      {...props}
      className={headButton({ active, align })}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="min-w-0 truncate">{children}</span>
      <HugeIcons data-icon="inline-end" icon={icon} />
    </Button>
  );
}

/**
 * The panel of a column of moments, which its head opens: both ways of sorting the rows above a calendar whose range
 * of days the page's filters hold under the column's ID, then Reset once days are chosen. The column's filter reads
 * each moment's day as the school's clock shows it (`withinDays`). The table draws the head's button (`trigger`), as it
 * draws every head's, so the button stands in its place in the line.
 */
export function DaysHead<TData extends RowData>({
  column,
  trigger,
}: {
  readonly column: Column<typeof dataTableFeatures, TData, unknown>;
  readonly trigger: ReactElement;
}) {
  const t = useTranslations("DataTable");
  const all = useTableFilters((state) => state.chosen);
  const choose = useTableFilters((state) => state.choose);
  const days = chosenDays(all, column.id);
  const sorted = column.getIsSorted() || "none";
  const from = Option.flatMap(days, ([first]) => parseCalendarDayKey(first));
  const to = Option.flatMap(days, ([, last]) => parseCalendarDayKey(last));

  return (
    <Popover>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex gap-1 border-b p-2">
          <Button
            aria-pressed={sorted === "asc"}
            onClick={() => column.toggleSorting(false)}
            size="sm"
            type="button"
            variant={sorted === "asc" ? "secondary" : "ghost"}
          >
            <HugeIcons icon={ArrowUp02Icon} />
            {t("sort-ascending")}
          </Button>
          <Button
            aria-pressed={sorted === "desc"}
            onClick={() => column.toggleSorting(true)}
            size="sm"
            type="button"
            variant={sorted === "desc" ? "secondary" : "ghost"}
          >
            <HugeIcons icon={ArrowDown02Icon} />
            {t("sort-descending")}
          </Button>
        </div>
        <Calendar
          {...Option.match(from, {
            onNone: () => ({}),
            onSome: (defaultMonth) => ({ defaultMonth }),
          })}
          mode="range"
          onSelect={(range) =>
            choose(
              column.id,
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
        {Option.isSome(days) ? (
          <div className="border-t p-2">
            <Button
              onClick={() => choose(column.id, [])}
              size="sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons icon={Cancel01Icon} />
              {t("reset")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
