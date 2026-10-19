"use client";

import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useSittingClock } from "@/components/exams/sitting/clock.client";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import { minutesLeft } from "@/components/tenant/home/left";
import {
  homeExamsRead,
  useHomeExams,
} from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/** One room that runs now, as the school home holds it. */
type Room = (typeof HomeView.Type)["live"][number];

/**
 * The rooms that run now and that the viewer may watch, each with its exam, its room, and the time
 * left before it closes. The time left keeps up with the device clock. A row opens the room's proctor
 * page. A failed read shows its own sentence and Try again inside this tile.
 */
export function LiveTile() {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <HomeTile hint={t("tile-live-footer")} title={t("tile-live")}>
      <ReadBoundary read={homeExamsRead(tenant.slug)}>
        <LiveRows />
      </ReadBoundary>
    </HomeTile>
  );
}

/** The rooms that run now, as rows, or the tile's empty state while no room runs. */
function LiveRows() {
  const t = useTranslations("School");
  const exams = useHomeExams();
  const now = useSittingClock();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (!QueryResult.isSuccess(exams)) {
    return null;
  }
  const rooms = exams.value.live;
  if (Arr.isReadonlyArrayEmpty(rooms)) {
    return <TileEmpty act="sleeping">{t("tile-live-empty")}</TileEmpty>;
  }
  return (
    <CardLinks>
      {Arr.map(rooms, (room) => (
        <LiveRow key={room.id} now={now} room={room} />
      ))}
    </CardLinks>
  );
}

/** One room that runs now, as a row that opens its proctor page. */
function LiveRow({ now, room }: { now: number; room: Room }) {
  const t = useTranslations("School");

  return (
    <CardLink
      href={`/exams/${room.examId}/sittings/${room.id}`}
      localized={false}
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
