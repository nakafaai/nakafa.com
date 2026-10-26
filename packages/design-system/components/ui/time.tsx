import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { isTimeOfDay, timeSlots } from "@repo/design-system/lib/calendar/time";
import { Array as Arr, DateTime } from "effect";
import type { ComponentProps } from "react";
import { useFormatter } from "use-intl";

/** The minutes between two times that a time select offers unless told otherwise. */
const QUARTER_HOUR = 15;

/**
 * A select of the times of one day, every `step` minutes from midnight, written as `HH:mm` and
 * named in the page's locale. The list opens on the chosen time and types ahead by its name, so
 * no time needs a long scroll. A chosen time between two steps keeps its place in the list. The
 * browser draws no time picker of its own.
 */
function TimeSelect({
  className,
  disabled,
  onValueChange,
  placeholder,
  step = QUARTER_HOUR,
  value,
  ...props
}: Omit<
  ComponentProps<typeof SelectTrigger>,
  "children" | "onChange" | "value"
> & {
  /** Receives the chosen time of day as `HH:mm`. */
  readonly onValueChange: (time: string) => void;
  /** What the select shows while no time is chosen: an example time or a short hint. */
  readonly placeholder: string;
  /** The minutes between two times that the select offers. */
  readonly step?: number | undefined;
  /** The chosen time of day as `HH:mm`, or an empty text while none is chosen. */
  readonly value: string;
}) {
  const format = useFormatter();
  const items = Arr.map(timeSlots(step, value), (time) => ({
    label: format.dateTime(
      DateTime.toDateUtc(DateTime.makeUnsafe(`1970-01-01T${time}:00.000Z`)),
      { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
    ),
    value: time,
  }));

  return (
    <Select
      disabled={disabled}
      items={items}
      onValueChange={(time: string | null) => {
        if (time !== null) {
          onValueChange(time);
        }
      }}
      value={isTimeOfDay(value) ? value : null}
    >
      <SelectTrigger className={className} {...props}>
        <HugeIcons className="text-muted-foreground" icon={Clock01Icon} />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Arr.map(items, (item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { TimeSelect };
