"use client";

import { QueryResult } from "@confect/react";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget.client";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import {
  studentSittingsRead,
  useStudentSittings,
} from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { orderSittings } from "@/components/tenant/sittings.client";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof StudentSittingRow.Type;

/**
 * The sittings a student may take part in, and the results of those that closed: the open ones first, then
 * the scheduled ones, then the finished ones. An open sitting's row enters it, and the footer's action
 * enters the first open sitting that the student has not finished. A finished sitting's row shows its
 * results once the teacher releases them. A student who holds no sitting sees Nina and why. The list's
 * submitted attempts drop the answers that the browser kept for them, which the server now holds. A failed
 * read shows its own sentence and Try again inside this tile, and the tile keeps its title and footer.
 */
export function StudentTile({ className }: { className?: string | undefined }) {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <ReadBoundary
      fallback={(failure) => (
        <HomeTile className={className} title={t("tile-student")}>
          {failure}
        </HomeTile>
      )}
      read={studentSittingsRead(tenant.slug)}
    >
      <StudentCard className={className} />
    </ReadBoundary>
  );
}

/**
 * The student's tile once its list is in. While the list loads, the tile keeps its frame with no
 * sentence, so no empty state shows before the answer.
 */
function StudentCard({ className }: { className?: string | undefined }) {
  const t = useTranslations("School");
  const listed = useStudentSittings();

  useEffect(() => {
    if (QueryResult.isSuccess(listed)) {
      forgetSubmittedKept(listed.value);
    }
  }, [listed]);

  if (QueryResult.isFailure(listed)) {
    throw listed.error;
  }
  if (!QueryResult.isSuccess(listed)) {
    return <HomeTile className={className} title={t("tile-student")} />;
  }
  return (
    <StudentRows className={className} sittings={orderSittings(listed.value)} />
  );
}

/** The student's sittings as rows, with the one action that enters the first sitting still to take. */
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
  const open = Arr.findFirst(
    sittings,
    (sitting) => sitting.state === "open" && sitting.attempt !== "submitted"
  );
  const scheduled = Arr.findFirst(
    sittings,
    (sitting) => sitting.state === "scheduled"
  );
  const hint = Option.isSome(open)
    ? te("student-enter-footer")
    : Option.match(scheduled, {
        onNone: () =>
          Arr.isReadonlyArrayEmpty(sittings)
            ? t("sittings-empty-description")
            : te("student-results-footer"),
        onSome: (next) =>
          t("sittings-next", {
            time:
              schoolDateTimeText({
                at: next.opensAt,
                locale,
                timeZone: next.timeZone,
              }) ?? "",
          }),
      });

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
      hint={hint}
      title={t("tile-student")}
    >
      {Arr.isReadonlyArrayEmpty(sittings) ? (
        <TileEmpty act="searching">{t("sittings-empty")}</TileEmpty>
      ) : (
        <CardLinks>
          {Arr.map(sittings, (sitting) => (
            <SittingRow key={sitting.id} sitting={sitting} />
          ))}
        </CardLinks>
      )}
    </HomeTile>
  );
}

/** One sitting of the student, as a row that opens the sitting and names what the student can do there. */
function SittingRow({ sitting }: { sitting: Sitting }) {
  return (
    <CardLink href={`/sittings/${sitting.id}`} title={sitting.examTitle}>
      <RowText detail={sitting.room} title={sitting.examTitle} />
      <span className="shrink-0 text-muted-foreground text-sm">
        <SittingRowAction sitting={sitting} />
      </span>
    </CardLink>
  );
}

/** The action text of one row of the student's list: its results, its entry, or its opening time. */
function SittingRowAction({ sitting }: { readonly sitting: Sitting }) {
  const te = useTranslations("Exams");
  const locale = useLocale();

  if (sitting.attempt === "submitted") {
    return (
      <>
        {sitting.resultsReleased
          ? te("student-view-results")
          : te("answers-in")}
      </>
    );
  }
  if (sitting.state === "open") {
    return <>{te("student-enter")}</>;
  }
  return (
    <>
      {schoolDateTimeText({
        at: sitting.opensAt,
        locale,
        timeZone: sitting.timeZone,
      })}
    </>
  );
}
