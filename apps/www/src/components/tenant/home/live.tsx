import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { CellSpan } from "@/components/tenant/home/cells";
import { minutesLeft } from "@/components/tenant/home/left";
import { progressPercent } from "@/components/tenant/home/progress";
import { SchoolHrefLink } from "@/lib/routing/school/link";

/** One room that runs now, as the school home holds it. */
type Room = (typeof HomeView.Type)["live"][number];

/**
 * The rooms that run now and that the viewer may watch, each with its exam, its room, the minutes left before it
 * closes, and a bar of the time that has passed since it opened. The bar and the minutes keep up with the clock of
 * the home, and a row opens the room's proctor page.
 */
export function LiveCell({
  now,
  rooms,
  span,
}: {
  now: number;
  rooms: readonly Room[];
  span: CellSpan;
}) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.CellHeader title={t("tile-live")} />
      <Dashboard.List>
        {Arr.map(rooms, (room) => (
          <LiveRow key={room.id} now={now} room={room} />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/** One room that runs now, as a row with its time left and its bar of time passed. */
function LiveRow({ now, room }: { now: number; room: Room }) {
  const t = useTranslations("School");
  const percent = progressPercent(room.opensAt, room.closesAt, now);

  return (
    <Dashboard.Row
      detail={room.room}
      footer={
        <Dashboard.Meter
          label={t("live-progress", { percent })}
          percent={percent}
        />
      }
      render={
        <SchoolHrefLink
          href={`/exams/${room.examId}/sittings/${room.id}`}
          title={room.examTitle}
        />
      }
      title={room.examTitle}
      trailing={
        <span className="shrink-0 text-muted-foreground text-sm">
          {t("tile-minutes-left", {
            count: minutesLeft(room.closesAt, now),
          })}
        </span>
      }
    />
  );
}
