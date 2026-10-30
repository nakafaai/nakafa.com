import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { TimeSelect } from "@repo/design-system/components/ui/time";
import {
  getCalendarDayKey,
  parseCalendarDayKey,
} from "@repo/design-system/lib/calendar/day-key";
import {
  joinLocalTime,
  type LocalTimeParts,
  splitLocalTime,
} from "@repo/design-system/lib/calendar/time";
import { fieldBoxVariants } from "@repo/design-system/lib/input";
import { cn } from "cn";
import { Array as Arr, DateTime, Option } from "effect";
import { type ComponentProps, useId, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";

/** The props of a date field, besides those its trigger button takes. */
type DatePickerProps = Omit<
  ComponentProps<"button">,
  "children" | "onChange" | "type" | "value"
> & {
  /** The last day the calendar offers, as a day key such as `2026-12-31`. */
  readonly max?: string | undefined;
  /** The first day the calendar offers, as a day key such as `2026-07-13`. */
  readonly min?: string | undefined;
  /** Receives the chosen day as its day key. */
  readonly onValueChange: (day: string) => void;
  /** What the field shows while no day is chosen: an example day or a short hint. */
  readonly placeholder: string;
  /** The chosen day as its day key, or an empty text while none is chosen. */
  readonly value: string;
};

/**
 * A field that holds one civil day, written as its day key such as `2026-10-27`. Its trigger is
 * drawn like a text field and names the day in the page's locale, or shows the placeholder; it
 * opens the calendar in a popover, and choosing a day closes it. `min` and `max` bound the days
 * that the calendar offers. The browser draws no picker of its own.
 */
function DatePicker({
  className,
  max,
  min,
  onValueChange,
  placeholder,
  value,
  ...props
}: DatePickerProps) {
  const format = useFormatter();
  const shownId = useId();
  const [open, setOpen] = useState(false);
  const chosen = parseCalendarDayKey(value);
  const first = parseCalendarDayKey(min ?? "");
  const last = parseCalendarDayKey(max ?? "");

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          fieldBoxVariants(),
          "cursor-pointer items-center gap-2 text-left data-placeholder:text-muted-foreground",
          className
        )}
        data-placeholder={Option.isNone(chosen) || undefined}
        data-slot="date-picker"
        {...props}
        aria-describedby={Arr.join(
          Arr.getSomes([
            Option.some(shownId),
            Option.fromUndefinedOr(props["aria-describedby"]),
          ]),
          " "
        )}
      >
        <HugeIcons
          className="size-4 shrink-0 text-muted-foreground"
          icon={Calendar03Icon}
        />
        <span className="flex-1 whitespace-nowrap" id={shownId}>
          {Option.isSome(chosen)
            ? format.dateTime(
                DateTime.toDateUtc(
                  DateTime.makeUnsafe(`${value}T00:00:00.000Z`)
                ),
                { dateStyle: "medium", timeZone: "UTC" }
              )
            : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          autoFocus
          {...Option.match(
            Option.orElse(chosen, () => first),
            {
              onNone: () => ({}),
              onSome: (defaultMonth) => ({ defaultMonth }),
            }
          )}
          disabled={Arr.getSomes([
            Option.map(first, (before) => ({ before })),
            Option.map(last, (after) => ({ after })),
          ])}
          {...Option.match(first, {
            onNone: () => ({}),
            onSome: (startMonth) => ({ startMonth }),
          })}
          {...Option.match(last, {
            onNone: () => ({}),
            onSome: (endMonth) => ({ endMonth }),
          })}
          mode="single"
          onSelect={(day) => {
            onValueChange(getCalendarDayKey(day));
            setOpen(false);
          }}
          required
          selected={Option.getOrUndefined(chosen)}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A field that holds one local time, written as a `datetime-local` value such as
 * `2026-10-27T08:15`: a date field and a time select side by side in one group. The label of the
 * field names its date trigger, by `id`. While the value holds no time, the field keeps the half
 * the person chose, and it reports a value once both halves are chosen.
 */
function DateTimePicker({
  className,
  dayPlaceholder,
  id,
  max,
  min,
  onValueChange,
  step,
  timePlaceholder,
  value,
}: {
  readonly className?: string | undefined;
  /** What the date shows while no day is chosen. */
  readonly dayPlaceholder: string;
  /** The id of the date trigger, which the field's label names. */
  readonly id?: string | undefined;
  /** The last day the calendar offers, as a day key. */
  readonly max?: string | undefined;
  /** The first day the calendar offers, as a day key. */
  readonly min?: string | undefined;
  /** Receives the chosen local time once both its day and its time are chosen. */
  readonly onValueChange: (local: string) => void;
  /** The minutes between two times that the time select offers. */
  readonly step?: number | undefined;
  /** What the time shows while no time is chosen. */
  readonly timePlaceholder: string;
  /** The chosen local time, or an empty text while none is chosen. */
  readonly value: string;
}) {
  const t = useTranslations("Common");
  const [draft, setDraft] = useState<LocalTimeParts>({ day: "", time: "" });
  const parts = Option.getOrElse(splitLocalTime(value), () => draft);
  const choose = (next: LocalTimeParts) => {
    setDraft(next);
    const local = joinLocalTime(next);
    if (Option.isSome(local)) {
      onValueChange(local.value);
    }
  };

  return (
    <ButtonGroup
      className={cn("w-full", className)}
      data-slot="date-time-picker"
    >
      <DatePicker
        className="flex-1"
        id={id}
        max={max}
        min={min}
        onValueChange={(day) => choose({ ...parts, day })}
        placeholder={dayPlaceholder}
        value={parts.day}
      />
      <TimeSelect
        aria-label={t("time")}
        onValueChange={(time) => choose({ ...parts, time })}
        placeholder={timePlaceholder}
        step={step}
        value={parts.time}
      />
    </ButtonGroup>
  );
}

export { DatePicker, DateTimePicker };
