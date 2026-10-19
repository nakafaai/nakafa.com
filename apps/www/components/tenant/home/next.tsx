"use client";

import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import { useHomeExams } from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";
import { schoolWeekdayTimeText } from "@/components/tenant/settings/clock";

/** One room that opens soon, as the school home holds it. */
type Room = (typeof HomeView.Type)["next"][number];

/**
 * The rooms that open within the next fourteen days, and that the viewer may watch, each with its
 * exam, its room, and its opening on the school's clock: the weekday and the time. A row opens the
 * exam. The footer's action opens every exam, and only a viewer who may open the exam list has it.
 */
export function NextTile() {
  const t = useTranslations("School");
  const tenant = useTenant();
  const exams = useHomeExams();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  return (
    <HomeTile
      action={
        tenant.canOpenExams ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/exams"
          >
            {t("tile-all-exams")}
          </Link>
        ) : undefined
      }
      hint={t("tile-next-footer")}
      title={t("tile-next")}
    >
      {QueryResult.isSuccess(exams) ? (
        <NextRows rooms={exams.value.next} />
      ) : null}
    </HomeTile>
  );
}

/** The rooms that open soon, as rows, or the tile's empty state while none opens. */
function NextRows({ rooms }: { rooms: readonly Room[] }) {
  const t = useTranslations("School");
  const locale = useLocale();

  if (Arr.isReadonlyArrayEmpty(rooms)) {
    return <TileEmpty act="relaxed">{t("tile-next-empty")}</TileEmpty>;
  }
  return (
    <CardLinks>
      {Arr.map(rooms, (room) => (
        <CardLink
          href={`/exams/${room.examId}`}
          key={room.id}
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
      ))}
    </CardLinks>
  );
}
