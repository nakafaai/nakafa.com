"use client";

import { QueryResult } from "@confect/react";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { Array as Arr, Option } from "effect";
import { type ReactNode, useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget.client";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import { Bento, type BentoTile } from "@/components/tenant/home/bento";
import { type StudentTile, studentPlan } from "@/components/tenant/home/layout";
import {
  studentSittingsRead,
  useStudentSittings,
} from "@/components/tenant/home/query.client";
import {
  AllExamsAction,
  HomeTile,
  RowText,
  TILE_ROWS,
} from "@/components/tenant/home/tile";
import { HomeFailure, HomeTitle } from "@/components/tenant/home/title";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import {
  enterableSitting,
  orderSittings,
} from "@/components/tenant/sittings.client";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof StudentSittingRow.Type;

/**
 * The home of a student: the sittings that are open or scheduled, then the results of the sittings that closed.
 * A student with neither sees Nina searching and one sentence under the title, with no card. While the list loads,
 * only the title shows, and a failed read shows its own sentence and Try again below the title.
 */
export function StudentHome() {
  const tenant = useTenant();

  return (
    <ReadBoundary
      fallback={(failure) => <HomeFailure failure={failure} />}
      read={studentSittingsRead(tenant.slug)}
    >
      <StudentTiles />
    </ReadBoundary>
  );
}

/** The student's tiles and quiet state, from the list the student's sittings read returns. */
function StudentTiles() {
  const t = useTranslations("School");
  const te = useTranslations("Exams");
  const locale = useLocale();
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
    return <HomeTitle />;
  }
  const sittings = orderSittings(listed.value);
  const upcoming = Arr.filter(
    sittings,
    (sitting) => sitting.state !== "closed"
  );
  // The closed sittings come oldest first in the order of the list, so the results read newest first.
  const finished = Arr.reverse(
    Arr.filter(sittings, (sitting) => sitting.state === "closed")
  );
  const plan = studentPlan({
    results: finished.length,
    sittings: upcoming.length,
  });
  const open = enterableSitting(sittings);
  const scheduled = Arr.findFirst(
    upcoming,
    (sitting) => sitting.state === "scheduled"
  );
  const footer = Option.isSome(open)
    ? te("student-enter-footer")
    : Option.match(scheduled, {
        onNone: () => te("student-results-footer"),
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
  const nodes: Record<StudentTile, ReactNode> = {
    results: <StudentResultsTile className="h-full" sittings={finished} />,
    sittings: (
      <StudentSittingsTile
        className="h-full"
        footer={footer}
        sittings={upcoming}
      />
    ),
  };

  return (
    <>
      <HomeTitle
        quiet={
          plan.quiet
            ? { act: "searching", sentence: t("sittings-empty") }
            : undefined
        }
      />
      <Bento
        tiles={Arr.map(
          plan.tiles,
          (tile): BentoTile => ({ key: tile, node: nodes[tile] })
        )}
      />
    </>
  );
}

/** The sittings the student may still take part in, as rows that open each sitting, with the footer's sentence. */
function StudentSittingsTile({
  className,
  footer,
  sittings,
}: {
  className?: string | undefined;
  footer: string;
  sittings: readonly Sitting[];
}) {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <HomeTile
      action={
        sittings.length > TILE_ROWS && tenant.canOpenExams ? (
          <AllExamsAction />
        ) : undefined
      }
      className={className}
      hint={footer}
      title={t("tile-student")}
    >
      <CardLinks>
        {Arr.map(Arr.take(sittings, TILE_ROWS), (sitting) => (
          <SittingRow key={sitting.id} sitting={sitting} />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/** One sitting that the student may still take part in, as a row that opens it, with its state or its opening. */
function SittingRow({ sitting }: { sitting: Sitting }) {
  return (
    <CardLink
      href={`/sittings/${sitting.id}`}
      localized={false}
      title={sitting.examTitle}
    >
      <RowText detail={sitting.room} title={sitting.examTitle} />
      <span className="shrink-0 text-muted-foreground text-sm">
        <SittingAction sitting={sitting} />
      </span>
    </CardLink>
  );
}

/** The end of a sitting's row: its answers once saved, its state while it is open, or the time it opens. */
function SittingAction({ sitting }: { sitting: Sitting }) {
  const t = useTranslations("School");
  const locale = useLocale();

  if (sitting.attempt === "submitted") {
    return <>{t("answers-saved")}</>;
  }
  if (sitting.state === "open") {
    return <>{t("sitting-open-now")}</>;
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

/** The results of the sittings that closed, as rows that open each sitting, with whether the results are released. */
function StudentResultsTile({
  className,
  sittings,
}: {
  className?: string | undefined;
  sittings: readonly Sitting[];
}) {
  const t = useTranslations("School");
  const te = useTranslations("Exams");
  const tenant = useTenant();

  return (
    <HomeTile
      action={
        sittings.length > TILE_ROWS && tenant.canOpenExams ? (
          <AllExamsAction />
        ) : undefined
      }
      className={className}
      hint={te("student-results-footer")}
      title={t("tile-results")}
    >
      <CardLinks>
        {Arr.map(Arr.take(sittings, TILE_ROWS), (sitting) => (
          <ResultRow key={sitting.id} sitting={sitting} />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/** One closed sitting, as a row that opens it and says whether its results are released. */
function ResultRow({ sitting }: { sitting: Sitting }) {
  const t = useTranslations("School");
  const te = useTranslations("Exams");

  return (
    <CardLink
      href={`/sittings/${sitting.id}`}
      localized={false}
      title={sitting.examTitle}
    >
      <RowText detail={sitting.room} title={sitting.examTitle} />
      <span className="shrink-0 text-muted-foreground text-sm">
        {sitting.resultsReleased
          ? te("student-view-results")
          : t("answers-saved")}
      </span>
    </CardLink>
  );
}
