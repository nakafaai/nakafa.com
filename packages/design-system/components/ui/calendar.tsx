import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { boundedMonth } from "@repo/design-system/lib/calendar/month";
import type { CalendarSelectState } from "@ui-sdk/react/calendar";
import {
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarMonthSelect,
  CalendarNext,
  CalendarPrevious,
  Calendar as CalendarPrimitive,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  CalendarYearSelect,
  createCalendarController,
} from "@ui-sdk/react/calendar";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

/** What turns the month a calendar shows: its own controller, or the date field's that holds it. */
interface MonthTurner {
  readonly getMonth: () => string;
  readonly setMonth: (month: string) => unknown;
}

/** The days a calendar offers, as day keys such as `2026-07-13`. */
type CalendarBounds = Parameters<typeof boundedMonth>[2];

/**
 * One day of the grid: the reader's day takes the accent, a chosen day the primary, and the days between the ends of a
 * range the accent again, as one band. A day of the months around reads muted, a day outside the bounds reads faint and
 * takes no press, and a day the calendar names unavailable reads struck through, though the keys still reach it.
 */
const calendarDayVariants = cva(
  "focus-visible:ring-ring/50 data-today:bg-accent data-today:text-accent-foreground data-outside:text-muted-foreground data-preview:bg-accent data-range-middle:bg-accent data-range-middle:text-accent-foreground data-selected:not-data-range-middle:bg-primary data-selected:not-data-range-middle:text-primary-foreground hover:not-data-selected:bg-accent hover:not-data-selected:text-accent-foreground relative size-(--cell-size) cursor-pointer rounded-md p-0 text-center text-sm tabular-nums outline-none select-none focus-visible:z-10 focus-visible:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50 data-range-end:not-data-range-start:rounded-s-none data-range-middle:rounded-none data-range-start:not-data-range-end:rounded-e-none data-unavailable:line-through"
);

/**
 * One of the caption's two selects, the month or the year, drawn from what the calendar offers: a month outside its
 * bounds cannot be chosen, and a year that would show one shows the nearest month within them.
 */
function CalendarCaptionSelect({
  icon,
  label,
  onChoose,
  state,
  width,
}: {
  readonly icon: typeof Calendar01Icon;
  readonly label: string;
  readonly onChoose: (value: number) => void;
  readonly state: CalendarSelectState;
  readonly width: "fill" | "fit";
}) {
  const items = Arr.map(state.options, (option) => ({
    disabled: option.disabled,
    label: option.label,
    value: String(option.value),
  }));

  return (
    <Select
      disabled={state.disabled}
      items={items}
      onValueChange={(value: string | null) => {
        if (value !== null) {
          onChoose(Number(value));
        }
      }}
      value={String(state.value)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "data-[size=sm]:h-(--cell-size)",
          width === "fill" ? "min-w-0 flex-1" : "shrink-0"
        )}
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent label={label}>
        {Arr.map(items, (item) => (
          <SelectItem
            disabled={item.disabled}
            icon={icon}
            key={item.value}
            value={item.value}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * What a calendar draws, alone or in a date field's popup: the month it shows as one button group, the previous
 * month, the month, the year and the next month, then the month's grid. The month's controls stand as tall as its
 * days, so a calendar that draws larger days, such as a table's filter beside its other controls, keeps one height. A calendar that names no bounds offers ten
 * years on each side of the shown year. The month's name stays in the page for screen readers, which hear it change.
 */
function CalendarBody({
  bounds,
  turner,
}: {
  readonly bounds: CalendarBounds;
  readonly turner: MonthTurner;
}) {
  const t = useTranslations("Common");
  const shown = () => {
    const [year = "", month = ""] = turner.getMonth().split("-");
    return { month: Number(month), year: Number(year) };
  };

  return (
    <div className="flex w-full flex-col gap-4" data-slot="calendar-body">
      <ButtonGroup className="w-full">
        <CalendarPrevious
          aria-label={t("previous-month")}
          render={
            <Button
              className="size-(--cell-size)"
              size="icon-sm"
              tooltip={t("previous-month")}
            />
          }
        >
          <HugeIcons className="rtl:rotate-180" icon={ArrowLeft01Icon} />
        </CalendarPrevious>
        <CalendarMonthSelect
          render={(_props, state) => (
            <CalendarCaptionSelect
              icon={Calendar01Icon}
              label={t("month")}
              onChoose={(month) =>
                turner.setMonth(boundedMonth(shown().year, month, bounds))
              }
              state={state}
              width="fill"
            />
          )}
        />
        <CalendarYearSelect
          render={(_props, state) => (
            <CalendarCaptionSelect
              icon={Calendar03Icon}
              label={t("year")}
              onChoose={(year) =>
                turner.setMonth(boundedMonth(year, shown().month, bounds))
              }
              state={state}
              width="fit"
            />
          )}
        />
        <CalendarNext
          aria-label={t("next-month")}
          render={
            <Button
              className="size-(--cell-size)"
              size="icon-sm"
              tooltip={t("next-month")}
            />
          }
        >
          <HugeIcons className="rtl:rotate-180" icon={ArrowRight01Icon} />
        </CalendarNext>
      </ButtonGroup>
      <CalendarHeading className="sr-only" />
      <CalendarGrid className="w-full border-collapse">
        <CalendarWeekdays>
          {(index) => (
            <CalendarWeekday
              className="text-muted-foreground size-(--cell-size) text-xs font-normal select-none"
              index={index}
            />
          )}
        </CalendarWeekdays>
        <CalendarWeeks>
          {(cell) => (
            <CalendarDay className={calendarDayVariants()} value={cell.date} />
          )}
        </CalendarWeeks>
      </CalendarGrid>
    </div>
  );
}

/**
 * A month grid to pick a day, several days or a range, in the reader's locale, its values day keys such as
 * `2026-10-16`. A date field opens it in a popup; a filter of a date column shows it inline. The arrow keys move
 * through the days, and a controller drives it from anywhere, an agent's tools included.
 */
function Calendar({
  className,
  controller,
  showOutsideDays = true,
  ...props
}: Omit<ComponentProps<typeof CalendarPrimitive>, "children">) {
  const [own] = useState(createCalendarController);
  const turner = controller ?? own;

  return (
    <CalendarPrimitive
      className={cn(
        "bg-background [--cell-size:--spacing(8)] w-fit p-3",
        className
      )}
      controller={turner}
      locale={useLocale()}
      showOutsideDays={showOutsideDays}
      {...props}
    >
      <CalendarBody
        bounds={{ max: props.max, min: props.min }}
        turner={turner}
      />
    </CalendarPrimitive>
  );
}

export { Calendar, CalendarBody };
