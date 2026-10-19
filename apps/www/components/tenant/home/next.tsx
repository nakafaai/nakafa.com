"use client";

import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import {
  homeExamsRead,
  useHomeExams,
} from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { schoolWeekdayTimeText } from "@/components/tenant/settings/clock";

/** One room that opens soon, as the school home holds it. */
type Room = (typeof HomeView.Type)["next"][number];

/**
 * The rooms that open within the next fourteen days, and that the viewer may watch, each with its
 * exam, its room, and its opening on the school's clock: the weekday and the time. A row opens the
 * exam. A failed read shows its own sentence and Try again inside this tile.
 */
export function NextTile() {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <HomeTile hint={t("tile-next-footer")} title={t("tile-next")}>
      <ReadBoundary read={homeExamsRead(tenant.slug)}>
        <NextRows />
      </ReadBoundary>
    </HomeTile>
  );
}

/** The rooms that open soon, as rows, or the tile's empty state while none opens. */
function NextRows() {
  const t = useTranslations("School");
  const locale = useLocale();
  const exams = useHomeExams();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (!QueryResult.isSuccess(exams)) {
    return null;
  }
  const rooms = exams.value.next;
  if (Arr.isReadonlyArrayEmpty(rooms)) {
    return <TileEmpty act="relaxed">{t("tile-next-empty")}</TileEmpty>;
  }
  return (
    <CardLinks>
      {Arr.map(rooms, (room) => (
        <NextRow key={room.id} locale={locale} room={room} />
      ))}
    </CardLinks>
  );
}

/** One room that opens soon, as a row that opens its exam. */
function NextRow({ locale, room }: { locale: string; room: Room }) {
  return (
    <CardLink href={`/exams/${room.examId}`} title={room.examTitle}>
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
