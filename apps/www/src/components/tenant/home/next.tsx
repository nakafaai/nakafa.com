import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import {
  AllExamsAction,
  HomeTile,
  RowText,
  TILE_ROWS,
} from "@/components/tenant/home/tile";
import { schoolWeekdayTimeText } from "@/components/tenant/settings/clock";
import { schoolExamTarget } from "@/lib/routing/school/target";

/** One room that opens soon, as the school home holds it. */
type Room = (typeof HomeView.Type)["next"][number];

/**
 * The rooms that open within the next fourteen days and that the viewer may watch, each with its exam, its room,
 * and its opening on the school's clock: the weekday and the time. A row opens the exam. A tile with more rooms
 * than it shows ends with All exams.
 */
export function NextTile({
  className,
  rooms,
}: {
  className?: string | undefined;
  rooms: readonly Room[];
}) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const locale = useLocale();

  return (
    <HomeTile
      action={
        rooms.length > TILE_ROWS && tenant.canOpenExams ? (
          <AllExamsAction />
        ) : undefined
      }
      className={className}
      hint={t("tile-next-footer")}
      title={t("tile-next")}
    >
      <CardLinks>
        {Arr.map(Arr.take(rooms, TILE_ROWS), (room) => (
          <NextRow key={room.id} locale={locale} room={room} />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/** One room that opens soon, as a row that opens its exam. */
function NextRow({ locale, room }: { locale: string; room: Room }) {
  const tenant = useTenant();
  return (
    <CardLink
      target={schoolExamTarget(tenant.slug, room.examId)}
      title={room.examTitle}
    >
      <RowText detail={room.room} title={room.examTitle} />
      <span className="shrink-0 text-muted-foreground text-sm">
        {schoolWeekdayTimeText({
          at: room.opensAt,
          locale,
          timeZone: room.timeZone,
        })}
      </span>
    </CardLink>
  );
}
