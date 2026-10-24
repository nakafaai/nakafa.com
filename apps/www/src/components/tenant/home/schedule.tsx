import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { CellSpan } from "@/components/tenant/home/cells";
import { useHomeNow } from "@/components/tenant/home/clock";
import {
  type ScheduleDay,
  type ScheduleRoom,
  scheduleDays,
} from "@/components/tenant/home/strip";
import { type LinkTarget, TargetLink } from "@/lib/routing/link";

/** One room of the schedule, with the text that its row shows at the end. */
export type ScheduleItem = ScheduleRoom & {
  /** The page that the room's bar and row open. */
  readonly target: LinkTarget;
  readonly trailing: ReactNode;
};

/**
 * The schedule of the next fourteen days: one column for each day, with its rooms as bars stacked in it from the first
 * bar up, and today's column marked. Each bar opens its room. Below the chart the rooms are rows, so each room has its
 * name, its place and its time as text. The list holds at most the rooms its read bounds, and `bound` names that bound
 * when the list reached it, so the schedule says that it draws no more. The chart is drawn with plain elements, so no
 * chart library is needed.
 */
export function ScheduleCell({
  bound,
  items,
  span,
}: {
  /** The most rooms that the list holds, when it reached that bound, and none otherwise. */
  bound: number | null;
  items: readonly ScheduleItem[];
  span: CellSpan;
}) {
  const t = useTranslations("School");
  const now = useHomeNow();
  const days = scheduleDays(items, now);

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-schedule")} />
      <div className="flex gap-1 px-6">
        {Arr.map(days, (day, index) => (
          <ScheduleColumn day={day} index={index} key={day.key} />
        ))}
      </div>
      {bound === null ? null : (
        <Dashboard.Period>
          {t("schedule-bound", { count: bound })}
        </Dashboard.Period>
      )}
      <Dashboard.List>
        {Arr.map(items, (item) => (
          <ScheduleRow item={item} key={item.id} />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/**
 * One day of the schedule: its rooms as bars, and its day of the month under them. On a narrow dashboard every other
 * day's number is left out, so the numbers never touch.
 */
function ScheduleColumn({
  day,
  index,
}: {
  day: ScheduleDay<ScheduleItem>;
  index: number;
}) {
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
          index % 2 === 1 && "@min-[600px]:block hidden",
          day.today ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {day.day}
      </span>
    </div>
  );
}

/**
 * One room of a day, as a bar that opens the room. The bar is eight pixels high, and its link reaches twenty-four
 * pixels, so the bar is easy to hit. Its name is the bar's accessible name.
 */
function ScheduleBar({ room }: { room: ScheduleItem }) {
  return (
    <TargetLink
      aria-label={`${room.title}, ${room.room}`}
      className="-my-2 box-content block h-2 rounded-xs bg-primary bg-clip-content py-2 transition-opacity ease-out hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      target={room.target}
      title={room.title}
    />
  );
}

/** One room of the schedule as a row, which opens the room and says where and when it is. */
function ScheduleRow({ item }: { item: ScheduleItem }) {
  return (
    <Dashboard.Row
      detail={item.room}
      icon={Calendar03Icon}
      render={<TargetLink target={item.target} title={item.title} />}
      title={item.title}
      trailing={item.trailing}
    />
  );
}
