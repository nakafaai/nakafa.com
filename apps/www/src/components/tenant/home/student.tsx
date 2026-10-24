import { QueryResult } from "@confect/react";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr, Option } from "effect";
import { Fragment, useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget";
import { useTenant } from "@/components/tenant/context";
import { type CellSpan, placeCells } from "@/components/tenant/home/cells";
import { useHomeNow } from "@/components/tenant/home/clock";
import { minutesLeft } from "@/components/tenant/home/left";
import {
  studentSittingsRead,
  useStudentSittings,
} from "@/components/tenant/home/query";
import { ScheduleCell } from "@/components/tenant/home/schedule";
import { studentShown } from "@/components/tenant/home/shown";
import {
  type ScheduleRoom,
  scheduleDays,
} from "@/components/tenant/home/strip";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { enterableSitting, orderSittings } from "@/components/tenant/sittings";
import { SchoolHrefLink } from "@/lib/routing/school/link";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof StudentSittingRow.Type;

/**
 * The cells of a student's home: the sitting that is open now or the next one, with its countdown, the student's
 * schedule for the next fourteen days, and the results of the sittings that closed, with the student's score once it
 * is released. A student with no sitting and no result sees Nina searching and one sentence, with no cell. While the
 * list loads nothing shows below the header, and a failed read shows its own sentence and Try again.
 */
export function StudentHome() {
  const tenant = useTenant();

  return (
    <ReadBoundary read={studentSittingsRead(tenant.slug)}>
      <StudentCells />
    </ReadBoundary>
  );
}

/** The student's cells, from the list that the student's sittings read returns. */
function StudentCells() {
  const now = useHomeNow();
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
    return null;
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
  const next = Option.orElse(enterableSitting(sittings), () =>
    Arr.findFirst(upcoming, (sitting) => sitting.state === "scheduled")
  );
  const days = scheduleDays(Arr.map(upcoming, scheduleRoomOf), now);
  const shown = studentShown({
    finished: finished.length,
    hasNow: Option.isSome(next),
    scheduled: Arr.flatMap(days, (day) => day.rooms).length,
    upcoming: upcoming.length,
  });
  const cells = placeCells([
    {
      draw: (span) =>
        Option.match(next, {
          onNone: () => null,
          onSome: (sitting) => (
            <NowCell now={now} sitting={sitting} span={span} />
          ),
        }),
      key: "now",
      shown: shown.now,
      three: 2,
      two: 2,
    },
    {
      draw: (span) => <ScheduleCell days={days} span={span} />,
      key: "schedule",
      shown: shown.schedule,
      three: 2,
      two: 2,
    },
    {
      draw: (span) => <StudentResultsCell sittings={finished} span={span} />,
      key: "results",
      shown: shown.results,
      three: 1,
      two: 1,
    },
    {
      draw: (span) => <QuietCell span={span} />,
      key: "quiet",
      shown: shown.quiet,
      three: 3,
      two: 2,
    },
  ]);

  return (
    <Dashboard>
      {Arr.map(cells, (cell) => (
        <Fragment key={cell.key}>{cell.draw(cell)}</Fragment>
      ))}
    </Dashboard>
  );
}

/** A sitting as a schedule bar, which opens the sitting for the student. */
function scheduleRoomOf(sitting: Sitting): ScheduleRoom {
  return {
    href: `/sittings/${sitting.id}`,
    id: sitting.id,
    opensAt: sitting.opensAt,
    room: sitting.room,
    timeZone: sitting.timeZone,
    title: sitting.examTitle,
  };
}

/**
 * The sitting that is open now, with the minutes left before it closes, or the next sitting, with the time it opens.
 * Its row opens the sitting.
 */
function NowCell({
  now,
  sitting,
  span,
}: {
  now: number;
  sitting: Sitting;
  span: CellSpan;
}) {
  const t = useTranslations("School");
  const locale = useLocale();
  const opening = schoolDateTimeText({
    at: sitting.opensAt,
    locale,
    timeZone: sitting.timeZone,
  });

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.CellHeader title={t("tile-now")} />
      {sitting.state === "open" ? (
        <>
          <Dashboard.Value>
            {minutesLeft(sitting.closesAt, now)}
          </Dashboard.Value>
          <Dashboard.Period>
            {t("now-left", { count: minutesLeft(sitting.closesAt, now) })}
          </Dashboard.Period>
        </>
      ) : (
        <Dashboard.Period>
          {t("sittings-next", { time: opening ?? "" })}
        </Dashboard.Period>
      )}
      <Dashboard.List>
        <Dashboard.Row
          detail={sitting.room}
          render={
            <SchoolHrefLink
              href={`/sittings/${sitting.id}`}
              title={sitting.examTitle}
            />
          }
          title={sitting.examTitle}
        />
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/** The results of the sittings that closed, newest first, each with the student's score once it is released. */
function StudentResultsCell({
  sittings,
  span,
}: {
  sittings: readonly Sitting[];
  span: CellSpan;
}) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.CellHeader title={t("tile-results")} />
      <Dashboard.List>
        {Arr.map(sittings, (sitting) => (
          <StudentResultRow key={sitting.id} sitting={sitting} />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/** One closed sitting, as a row that opens it, with the student's score as its trailing value once it is released. */
function StudentResultRow({ sitting }: { sitting: Sitting }) {
  const t = useTranslations("School");
  const te = useTranslations("Exams");

  return (
    <Dashboard.Row
      detail={sitting.room}
      render={
        <SchoolHrefLink
          href={`/sittings/${sitting.id}`}
          title={sitting.examTitle}
        />
      }
      title={sitting.examTitle}
      trailing={
        <span className="shrink-0 text-muted-foreground text-sm">
          {sitting.score === null
            ? t("answers-saved")
            : te("student-score", {
                points: sitting.score.points,
                total: sitting.score.total,
              })}
        </span>
      }
    />
  );
}

/** The quiet state of a student who has no sitting and no result yet. */
function QuietCell({ span }: { span: CellSpan }) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.Empty act="searching">{t("sittings-empty")}</Dashboard.Empty>
    </Dashboard.Cell>
  );
}
