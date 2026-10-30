import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { useHomeNow } from "@/components/tenant/home/clock";
import { minutesLeft } from "@/components/tenant/home/left";
import {
  HomeCard,
  HomeRow,
  HomeRowText,
  HomeSection,
} from "@/components/tenant/home/section";
import { schoolDayTimeText } from "@/components/tenant/settings/clock";
import { TargetLink } from "@/lib/routing/link";
import { schoolExamSittingTarget } from "@/lib/routing/school/target";

/** One room of the staff home, as the home's exam read returns it. */
type Room = (typeof HomeView.Type)["live"][number];

/**
 * The rooms the viewer may watch that run now, then the ones that open within the next day, each a row that opens the
 * room's proctor page. A running room says how many minutes it has left, which the home's clock keeps current, and a
 * room still to open says when it opens, in its unit's time zone.
 */
export function RoomsSection({
  live,
  next,
}: {
  live: readonly Room[];
  next: readonly Room[];
}) {
  const t = useTranslations("School");

  return (
    <HomeSection title={t("home-rooms")}>
      <HomeCard>
        {Arr.map(live, (room) => (
          <LiveRoom key={room.id} room={room} />
        ))}
        {Arr.map(next, (room) => (
          <NextRoom key={room.id} room={room} />
        ))}
      </HomeCard>
    </HomeSection>
  );
}

/** A room that runs now, with the minutes it has left. */
function LiveRoom({ room }: { room: Room }) {
  const t = useTranslations("School");
  const now = useHomeNow();

  return (
    <RoomRow room={room}>
      <HomeRowText
        detail={room.room}
        title={room.examTitle}
        when={t("home-minutes-left", {
          count: minutesLeft(room.closesAt, now),
        })}
      />
    </RoomRow>
  );
}

/** A room that opens within the next day, with the day and time it opens. */
function NextRoom({ room }: { room: Room }) {
  const locale = useLocale();

  return (
    <RoomRow room={room}>
      <HomeRowText
        detail={room.room}
        title={room.examTitle}
        when={schoolDayTimeText({
          at: room.opensAt,
          locale,
          timeZone: room.timeZone,
        })}
      />
    </RoomRow>
  );
}

/** One room as a row that opens the room's proctor page, with the row's text as its children. */
function RoomRow({ children, room }: { children: ReactNode; room: Room }) {
  const { slug } = useTenant();

  return (
    <HomeRow
      render={
        <TargetLink
          target={schoolExamSittingTarget(slug, room.examId, room.id)}
        />
      }
    >
      {children}
    </HomeRow>
  );
}
