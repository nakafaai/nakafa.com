import { Clock01Icon } from "@hugeicons/core-free-icons";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { CellSpan } from "@/components/tenant/home/cells";
import { useHomeNow } from "@/components/tenant/home/clock";
import { minutesLeft } from "@/components/tenant/home/left";
import { progressPercent } from "@/components/tenant/home/progress";
import { useTenant } from "@/components/tenant/context";
import { TargetLink } from "@/lib/routing/link";
import { schoolExamSittingTarget } from "@/lib/routing/school/target";

/** One room that runs now, as the school home holds it. */
type Room = (typeof HomeView.Type)["live"][number];

/**
 * The rooms that run now and that the viewer may watch, each with its exam, its room, the minutes left before it
 * closes, and a bar of the time that has passed since it opened. The bar and the minutes keep up with the home's clock,
 * which starts from the server's time, and a row opens the room's proctor page.
 */
export function LiveCell({
  rooms,
  span,
}: {
  rooms: readonly Room[];
  span: CellSpan;
}) {
  const t = useTranslations("School");
  const now = useHomeNow();

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
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
  const tenant = useTenant();
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
      icon={Clock01Icon}
      render={
        <TargetLink
          target={schoolExamSittingTarget(tenant.slug, room.examId, room.id)}
          title={room.examTitle}
        />
      }
      title={room.examTitle}
      trailing={t("tile-minutes-left", {
        count: minutesLeft(room.closesAt, now),
      })}
    />
  );
}
