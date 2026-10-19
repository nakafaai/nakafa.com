"use client";

import { QueryResult } from "@confect/react";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useStudentSittings } from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { orderSittings } from "@/components/tenant/sittings.client";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof SittingView.Type;

/**
 * The sittings a student may take part in: the open ones first, then the scheduled ones. An open
 * sitting's row enters it, and the footer's action enters the first open sitting. A student who holds
 * no sitting sees Nina and why.
 */
export function StudentTile({ className }: { className?: string | undefined }) {
  const t = useTranslations("School");
  const listed = useStudentSittings();

  if (QueryResult.isFailure(listed)) {
    throw listed.error;
  }
  if (!QueryResult.isSuccess(listed)) {
    return (
      <HomeTile
        className={className}
        hint={t("sittings-empty-description")}
        title={t("tile-student")}
      />
    );
  }
  return (
    <StudentRows className={className} sittings={orderSittings(listed.value)} />
  );
}

/** The student's sittings as rows, with the one action that enters the first open sitting. */
function StudentRows({
  className,
  sittings,
}: {
  className?: string | undefined;
  sittings: readonly Sitting[];
}) {
  const t = useTranslations("School");
  const te = useTranslations("Exams");
  const locale = useLocale();
  const open = Arr.findFirst(sittings, (sitting) => sitting.state === "open");

  return (
    <HomeTile
      action={
        Option.isSome(open) ? (
          <Link
            className={buttonVariants()}
            href={`/sittings/${open.value.id}`}
          >
            {te("student-enter")}
          </Link>
        ) : undefined
      }
      className={className}
      hint={
        Option.isSome(open)
          ? te("student-enter-footer")
          : t("sittings-empty-description")
      }
      title={t("tile-student")}
    >
      {Arr.isReadonlyArrayEmpty(sittings) ? (
        <TileEmpty act="searching">{t("sittings-empty")}</TileEmpty>
      ) : (
        <CardLinks>
          {Arr.map(sittings, (sitting) => (
            <CardLink
              href={`/sittings/${sitting.id}`}
              key={sitting.id}
              localized={false}
              title={sitting.examTitle}
            >
              <RowText detail={sitting.room} title={sitting.examTitle} />
              <span className="shrink-0 text-muted-foreground text-sm">
                {sitting.state === "open"
                  ? te("student-enter")
                  : schoolDateTimeText({
                      at: sitting.opensAt,
                      locale,
                      timeZone: sitting.timeZone,
                    })}
              </span>
            </CardLink>
          ))}
        </CardLinks>
      )}
    </HomeTile>
  );
}
