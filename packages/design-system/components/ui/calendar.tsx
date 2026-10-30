import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { buttonVariants } from "@repo/design-system/lib/button";
import { getCalendarDayKey } from "@repo/design-system/lib/calendar/day-key";
import {
  captionChoices,
  chosenMonth,
  defaultBounds,
} from "@repo/design-system/lib/calendar/month";
import type { Locale } from "@repo/internationalization/src/locale";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { type ComponentProps, type Ref, useCallback } from "react";
import {
  type DayButton,
  DayPicker,
  getDefaultClassNames,
  type MonthCaption,
  useDayPicker,
} from "react-day-picker";
import { de } from "react-day-picker/locale/de";
import { enUS } from "react-day-picker/locale/en-US";
import { id } from "react-day-picker/locale/id";
import { useFormatter, useLocale, useTranslations } from "use-intl";

/** The words and the first weekday that the calendar draws in each Nakafa locale. */
const calendarLocales = { de, en: enUS, id } satisfies Record<
  Locale,
  ComponentProps<typeof DayPicker>["locale"]
>;

function CalendarRoot({
  className,
  rootRef,
  ...props
}: ComponentProps<"div"> & { rootRef?: Ref<HTMLDivElement> }) {
  return (
    <div
      className={cn(className)}
      data-slot="calendar"
      ref={rootRef}
      {...props}
    />
  );
}

function CalendarChevron({
  className,
  orientation,
  ...props
}: {
  className?: string;
  orientation?: "left" | "right" | "up" | "down";
}) {
  if (orientation === "left") {
    return (
      <HugeIcons
        className={cn("size-4", className)}
        icon={ArrowLeft01Icon}
        {...props}
      />
    );
  }

  if (orientation === "right") {
    return (
      <HugeIcons
        className={cn("size-4", className)}
        icon={ArrowRight01Icon}
        {...props}
      />
    );
  }

  return (
    <HugeIcons
      className={cn("size-4", className)}
      icon={ArrowDown01Icon}
      {...props}
    />
  );
}

/**
 * The month a calendar shows, as two selects between its arrows: the month, and the year. A month outside the
 * calendar's `startMonth` and `endMonth` cannot be chosen, and a year that would show one shows the nearest month
 * within them. A calendar that names no bounds offers ten years on each side of the shown year.
 */
function CalendarCaption({
  calendarMonth,
  displayIndex: _displayIndex,
  ...props
}: ComponentProps<typeof MonthCaption>) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const { dayPickerProps, goToMonth } = useDayPicker();
  const shown = calendarMonth.date;
  const year = shown.getFullYear();
  const fallback = defaultBounds(year);
  const bounds = Option.all({
    end: Option.orElse(
      Option.fromNullishOr(dayPickerProps.endMonth),
      () => fallback.end
    ),
    start: Option.orElse(
      Option.fromNullishOr(dayPickerProps.startMonth),
      () => fallback.start
    ),
  });

  if (Option.isNone(bounds)) {
    return <div {...props} />;
  }

  const { end, start } = bounds.value;
  const { months, years } = captionChoices(year, start, end);
  const monthItems = Arr.map(months, (month) => ({
    disabled: month.disabled,
    label: format.dateTime(month.date, { month: "long" }),
    value: String(month.month),
  }));
  const yearItems = Arr.map(years, (each) => ({
    label: String(each),
    value: String(each),
  }));

  return (
    <div {...props}>
      <div className="flex items-center gap-1.5">
        <Select
          items={monthItems}
          onValueChange={(value: string | null) => {
            if (value !== null) {
              Option.map(
                chosenMonth(year, Number(value), start, end),
                goToMonth
              );
            }
          }}
          value={String(shown.getMonth())}
        >
          <SelectTrigger aria-label={t("month")} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(monthItems, (item) => (
              <SelectItem
                disabled={item.disabled}
                key={item.value}
                value={item.value}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={yearItems}
          onValueChange={(value: string | null) => {
            if (value !== null) {
              Option.map(
                chosenMonth(Number(value), shown.getMonth(), start, end),
                goToMonth
              );
            }
          }}
          value={String(year)}
        >
          <SelectTrigger aria-label={t("year")} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(yearItems, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CalendarWeekNumber({ children, ...props }: ComponentProps<"td">) {
  return (
    <td {...props}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {children}
      </div>
    </td>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  buttonVariant = "ghost",
  components,
  ...props
}: ComponentProps<typeof DayPicker> & {
  buttonVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();
  const locale = calendarLocales[useLocale()];

  return (
    <DayPicker
      className={cn(
        "group/calendar bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent p-3 [--cell-size:--spacing(8)]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "select-none font-medium text-sm",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 select-none rounded-md font-normal text-muted-foreground text-xs",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "select-none text-muted-foreground text-xs",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:last-child[data-selected]_button]:rounded-r-md",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected]_button]:rounded-l-md"
            : "[&:first-child[data-selected]_button]:rounded-l-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "rounded-md bg-accent text-accent-foreground data-selected:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        MonthCaption: CalendarCaption,
        DayButton: CalendarDayButton,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      locale={locale}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const focusedButtonRef = useCallback(
    (button: HTMLButtonElement | null) => {
      if (modifiers.focused) {
        button?.focus();
      }
    },
    [modifiers.focused]
  );

  return (
    <Button
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-start=true]:rounded-l-md data-[range-end=true]:bg-primary data-[range-middle=true]:bg-accent data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-accent-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-3 group-data-[focused=true]/day:ring-ring/50 [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      data-day={getCalendarDayKey(day.date)}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      ref={focusedButtonRef}
      size="icon"
      variant="ghost"
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
