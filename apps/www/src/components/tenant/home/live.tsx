import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useSittingClock } from "@/components/exams/sitting/timer";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import { minutesLeft } from "@/components/tenant/home/left";
import {
  AllExamsAction,
  HomeTile,
  RowText,
  TILE_ROWS,
} from "@/components/tenant/home/tile";
import { schoolExamSittingTarget } from "@/lib/routing/school/target";

/** One room that runs now, as the school home holds it. */
type Room = (typeof HomeView.Type)["live"][number];

/**
 * The rooms that run now and that the viewer may watch, each with its exam, its room, and the time left before it
 * closes. The time left keeps up with the device clock, and a row opens the room's proctor page. A tile with more
 * rooms than it shows ends with All exams.
 */
export function LiveTile({
  className,
  rooms,
}: {
  className?: string | undefined;
  rooms: readonly Room[];
}) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const now = useSittingClock();

  return (
    <HomeTile
      action={
        rooms.length > TILE_ROWS && tenant.canOpenExams ? (
          <AllExamsAction />
        ) : undefined
      }
      className={className}
      hint={t("tile-live-footer")}
      title={t("tile-live")}
    >
      <CardLinks>
        {Arr.map(Arr.take(rooms, TILE_ROWS), (room) => (
          <LiveRow key={room.id} now={now} room={room} />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/** One room that runs now, as a row that opens its proctor page. */
function LiveRow({ now, room }: { now: number; room: Room }) {
  const t = useTranslations("School");

  return (
    <CardLink
      target={{
        host: "school",
        target: schoolExamSittingTarget(room.examId, room.id),
      }}
      title={room.examTitle}
    >
      <RowText detail={room.room} title={room.examTitle} />
      <span className="shrink-0 text-muted-foreground text-sm">
        {t("tile-minutes-left", {
          count: minutesLeft(room.closesAt, now),
        })}
      </span>
    </CardLink>
  );
}
