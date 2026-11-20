import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { CalendarBody } from "@repo/design-system/components/ui/calendar";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import { TimeSelect } from "@repo/design-system/components/ui/time";
import type { LocalTimeParts } from "@repo/design-system/lib/calendar/time";
import {
  joinLocalTime,
  splitLocalTime,
} from "@repo/design-system/lib/calendar/time";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { popupMotion, sheetSurface } from "@repo/design-system/lib/popup";
import {
  createDatePickerController,
  DatePickerContent,
  DatePickerInput,
  DatePicker as DatePickerPrimitive,
  DatePickerTrigger,
} from "@ui-sdk/react/date-picker";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Option } from "effect";
import type { ComponentProps } from "react";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

/**
 * The box of a date field, which draws the field around its text and its calendar button as one, so the field reads
 * as the text field beside it: its ring shows while either takes the keys, and its border turns red while the text is
 * not a day the field offers.
 */
const datePickerBoxVariants = cva(
  "border-input has-focus-visible:border-ring has-focus-visible:ring-ring/50 data-invalid:border-destructive data-invalid:ring-destructive/20 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] has-focus-visible:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50"
);

/** The props of a date field, besides those its text field takes. */
type DatePickerProps = Omit<
  ComponentProps<typeof DatePickerInput>,
  | "children"
  | "className"
  | "defaultValue"
  | "end"
  | "max"
  | "min"
  | "onChange"
  | "placeholder"
  | "type"
  | "value"
> & {
  readonly className?: string | undefined;
  /** The last day the field offers, as a day key such as `2026-12-31`. */
  readonly max?: string | undefined;
  /** The first day the field offers, as a day key such as `2026-07-13`. */
  readonly min?: string | undefined;
  /** Receives the chosen day as its day key, or an empty text once the field is cleared. */
  readonly onValueChange: (day: string) => void;
  /** What the field shows while no day is chosen: an example day or a short hint. */
  readonly placeholder: string;
  /** The chosen day as its day key, or an empty text while none is chosen. */
  readonly value: string;
};

/**
 * A field that holds one civil day, written as its day key such as `2026-10-27`. A reader types the day in the order
 * of the page's locale, `27/10/2026` or `27.10.2026`, or opens the calendar from the button at its end and presses a
 * day, which closes it. On a phone the calendar rises from the bottom as a sheet. `min` and `max` bound the days it
 * takes, typed or pressed; a typed day outside them, or text that is no day, marks the field invalid and keeps its
 * value. The field's `id` is its text's, so its label names it, and an agent sets it through its value as a reader does.
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
  const t = useTranslations("Common");
  const [controller] = useState(createDatePickerController);

  return (
    <DatePickerPrimitive
      className={cn(datePickerBoxVariants(), className)}
      controller={controller}
      locale={useLocale()}
      {...Option.match(Option.fromUndefinedOr(max), {
        onNone: () => ({}),
        onSome: (last) => ({ max: last }),
      })}
      {...Option.match(Option.fromUndefinedOr(min), {
        onNone: () => ({}),
        onSome: (first) => ({ min: first }),
      })}
      onValueChange={(next) => {
        onValueChange(typeof next === "string" ? next : "");
      }}
      presentation="auto"
      value={value === "" ? null : value}
    >
      <DatePickerInput
        className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent ps-3 text-base outline-none md:text-sm"
        placeholder={placeholder}
        {...props}
      />
      <ButtonGroupVariant value={undefined}>
        <DatePickerTrigger
          aria-label={t("choose-date")}
          className="me-1 shrink-0"
          render={
            <Button
              className="size-7"
              size="icon-sm"
              tooltip={t("choose-date")}
              variant="ghost"
            />
          }
        >
          <HugeIcons className="text-muted-foreground" icon={Calendar03Icon} />
        </DatePickerTrigger>
        <DatePickerContent
          align="start"
          className={cn(
            popupMotion(),
            sheetSurface(),
            "bg-popover text-popover-foreground z-50 rounded-md border p-3 shadow-md outline-none [--cell-size:--spacing(8)] data-[presentation=sheet]:[--cell-size:--spacing(11)]"
          )}
        >
          <SheetGrip />
          <CalendarBody bounds={{ max, min }} turner={controller} />
        </DatePickerContent>
      </ButtonGroupVariant>
    </DatePickerPrimitive>
  );
}

/**
 * A field that holds one local time, written as a `datetime-local` value such as
 * `2026-10-27T08:15`: a date field and a time select side by side in one group. The label of the
 * field names its date, by `id`. While the value holds no time, the field keeps the half
 * the person chose, and it reports a value once both halves are chosen. A field narrower than both
 * halves, in a drawer on the narrowest phone, gives up the time's clock, so the group stays in its column.
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
  /** The id of the date's text, which the field's label names. */
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
      className={cn("@container/when w-full", className)}
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
        className="@max-2xs/when:[&>svg:first-child]:hidden"
        onValueChange={(time) => choose({ ...parts, time })}
        placeholder={timePlaceholder}
        step={step}
        value={parts.time}
      />
    </ButtonGroup>
  );
}

export { DatePicker, DateTimePicker };
