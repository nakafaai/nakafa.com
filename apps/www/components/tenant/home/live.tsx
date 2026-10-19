"use client";

import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSittingClock } from "@/components/exams/sitting/clock.client";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { minutesLeft } from "@/components/tenant/home/left";
import { useHomeExams } from "@/components/tenant/home/query.client";
import {
  HomeTile,
  RowText,
  TileEmpty,
  TileWaiting,
} from "@/components/tenant/home/tile";

/** One room that runs now, as the school home holds it. */
type Room = (typeof HomeView.Type)["live"][number];

/**
 * The rooms that run now and that the viewer may watch, each with its exam, its room, and the time
 * left before it closes. The time left keeps up with the device clock. A row opens the room's proctor
 * page, and the footer's action opens every exam.
 */
export function LiveTile() {
  const t = useTranslations("School");
  const exams = useHomeExams();
  const now = useSittingClock();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  return (
    <HomeTile
      action={
        <Link className={buttonVariants({ variant: "outline" })} href="/exams">
          {t("tile-all-exams")}
        </Link>
      }
      hint={t("tile-live-footer")}
      title={t("tile-live")}
    >
      {QueryResult.isSuccess(exams) ? (
        <LiveRows now={now} rooms={exams.value.live} />
      ) : (
        <TileWaiting />
      )}
    </HomeTile>
  );
}

/** The rooms that run now, as rows, or the tile's empty state while no room runs. */
function LiveRows({ now, rooms }: { now: number; rooms: readonly Room[] }) {
  const t = useTranslations("School");

  if (Arr.isReadonlyArrayEmpty(rooms)) {
    return <TileEmpty act="sleeping">{t("tile-live-empty")}</TileEmpty>;
  }
  return (
    <CardLinks>
      {Arr.map(rooms, (room) => (
        <CardLink
          href={`/exams/${room.examId}/sittings/${room.id}`}
          key={room.id}
          title={room.examTitle}
        >
          <RowText detail={room.room} title={room.examTitle} />
          <span className="shrink-0 text-muted-foreground text-sm">
            {t("tile-minutes-left", {
              count: minutesLeft(room.closesAt, now),
            })}
          </span>
        </CardLink>
      ))}
    </CardLinks>
  );
}
