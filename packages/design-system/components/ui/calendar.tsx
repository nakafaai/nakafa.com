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
import { getCalendarDayKey } from "@repo/design-system/lib/calendar/day";
import {
  captionChoices,
  chosenMonth,
  defaultBounds,
} from "@repo/design-system/lib/calendar/month";
import type { Locale } from "@repo/internationalization/src/locale";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import type { ComponentProps, Ref } from "react";
import { useCallback } from "react";
import type { DayButton, MonthCaption } from "react-day-picker";
import {
  DayPicker,
  getDefaultClassNames,
  useDayPicker,
} from "react-day-picker";
import { de } from "react-day-picker/locale/de";
import { enUS } from "react-day-picker/locale/en-US";
import { id } from "react-day-picker/locale/id";
import { ms } from "react-day-picker/locale/ms";
import { useFormatter, useLocale, useTranslations } from "use-intl";

/** The words and the first weekday that the calendar draws in each Nakafa locale. */
const calendarLocales = { de, en: enUS, id, ms } satisfies Record<
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

/**
 * The month a calendar shows, as one button group: the previous month, the month, the year, and the next month. A month outside the
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
  const { dayPickerProps, goToMonth, nextMonth, previousMonth } =
    useDayPicker();
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
    label: format.dateTime(month.date, "month"),
    value: String(month.month),
  }));
  const yearItems = Arr.map(years, (each) => ({
    label: String(each),
    value: String(each),
  }));

  return (
    <div {...props}>
      <ButtonGroup className="w-full">
        <Button
          disabled={previousMonth === undefined}
          onClick={() => {
            Option.map(Option.fromNullishOr(previousMonth), goToMonth);
          }}
          size="icon-sm"
          tooltip={t("previous")}
        >
          <HugeIcons className="rtl:rotate-180" icon={ArrowLeft01Icon} />
        </Button>
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
          <SelectTrigger
            aria-label={t("month")}
            className="min-w-0 flex-1"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent label={t("menu-month")}>
            {Arr.map(monthItems, (item) => (
              <SelectItem
                disabled={item.disabled}
                icon={Calendar01Icon}
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
          <SelectTrigger aria-label={t("year")} className="shrink-0" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent label={t("menu-year")}>
            {Arr.map(yearItems, (item) => (
              <SelectItem
                icon={Calendar03Icon}
                key={item.value}
                value={item.value}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={nextMonth === undefined}
          onClick={() => {
            Option.map(Option.fromNullishOr(nextMonth), goToMonth);
          }}
          size="icon-sm"
          tooltip={t("next")}
        >
          <HugeIcons className="rtl:rotate-180" icon={ArrowRight01Icon} />
        </Button>
      </ButtonGroup>
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

/**
 * A month grid to pick a day or a range, in the reader's locale. A date field opens it in a popover; a filter of a
 * date column uses it too.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();
  const locale = calendarLocales[useLocale()];

  return (
    <DayPicker
      className={cn(
        "group/calendar bg-background p-3 [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        className
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "text-sm font-medium select-none",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 rounded-md text-xs font-normal select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-muted-foreground text-xs select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full p-0 text-center select-none",
          defaultClassNames.day
        ),
        range_start: cn(
          "bg-accent rounded-l-md",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md",
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
        MonthCaption: CalendarCaption,
        DayButton: CalendarDayButton,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      hideNavigation
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
        "data-[range-end=true]:bg-primary data-[range-middle=true]:bg-accent data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-accent-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 p-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-3 [&>span]:text-xs [&>span]:opacity-70",
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
      size="sm"
      variant="ghost"
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
