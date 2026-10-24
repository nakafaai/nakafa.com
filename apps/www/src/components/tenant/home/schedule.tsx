import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { CellSpan } from "@/components/tenant/home/cells";
import type { ScheduleDay, ScheduleRoom } from "@/components/tenant/home/strip";
import { SchoolHrefLink } from "@/lib/routing/school/link";

/**
 * The schedule of the next fourteen days, one column for each day with its rooms as bars stacked in it, from the
 * first bar up. Today's column is marked, and each bar is a link to its room. It is drawn with plain elements, so no
 * chart library is needed.
 */
export function ScheduleCell({
  days,
  span,
}: {
  days: readonly ScheduleDay<ScheduleRoom>[];
  span: CellSpan;
}) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.CellHeader title={t("tile-schedule")} />
      <div className="flex gap-1 px-6">
        {Arr.map(days, (day) => (
          <ScheduleColumn day={day} key={day.key} />
        ))}
      </div>
    </Dashboard.Cell>
  );
}

/** One day of the schedule: its rooms as bars, and its day of the month under them. */
function ScheduleColumn({ day }: { day: ScheduleDay<ScheduleRoom> }) {
  return (
    <div
      aria-current={day.today ? "date" : undefined}
      className="flex min-w-0 flex-1 flex-col gap-1"
    >
      <div className="flex min-h-24 flex-col justify-end gap-1">
        {Arr.map(day.rooms, (room) => (
          <ScheduleBar key={room.id} room={room} />
        ))}
      </div>
      <span
        className={cn(
          "text-center text-xs tabular-nums",
          day.today ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {day.day}
      </span>
    </div>
  );
}

/** One room of a day, as a bar that opens the room. Its name is the bar's accessible name. */
function ScheduleBar({ room }: { room: ScheduleRoom }) {
  return (
    <SchoolHrefLink
      aria-label={`${room.title}, ${room.room}`}
      className="block h-2 rounded-xs bg-primary transition-opacity ease-out hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      href={room.href}
      title={room.title}
    />
  );
}
