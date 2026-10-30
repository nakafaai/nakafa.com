import { QueryResult } from "@confect/react";
import { HOME_RESULT_LIMIT } from "@repo/backend/confect/exams/home/bounds";
import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr, Option } from "effect";
import { Fragment, useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant } from "@/components/tenant/context";
import { type CellSpan, placeCells } from "@/components/tenant/home/cells";
import { ClassesCell } from "@/components/tenant/home/classes";
import { useHomeNow } from "@/components/tenant/home/clock";
import { reachesBound } from "@/components/tenant/home/count";
import { minutesLeft } from "@/components/tenant/home/left";
import {
  studentSittingsRead,
  useStudentSittings,
} from "@/components/tenant/home/query";
import {
  ScheduleCell,
  type ScheduleItem,
} from "@/components/tenant/home/schedule";
import { studentShown } from "@/components/tenant/home/shown";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { schoolDayTimeText } from "@/components/tenant/settings/clock";
import { enterableSitting, orderSittings } from "@/components/tenant/sittings";
import { TargetLink } from "@/lib/routing/link";
import { schoolSittingTarget } from "@/lib/routing/school/target";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof StudentSittingRow.Type;

/**
 * The cells of a student's home on one connected dashboard: the sitting that is open now or the next one, with its
 * countdown and its action, the student's classes, the student's schedule for the next fourteen days with each sitting
 * as a row, and the results of the sittings that closed, with the student's score once it is released. A student with
 * no sitting and no result sees Nina searching and one sentence in place of the sitting cells. While the sittings and
 * the classes load nothing shows below the header, and a failed read shows its own sentence and Try again.
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
  const tenant = useTenant();
  const listed = useStudentSittings();
  const classes = useMyClasses();

  useEffect(() => {
    if (QueryResult.isSuccess(listed)) {
      forgetSubmittedKept(listed.value);
    }
  }, [listed]);

  if (QueryResult.isFailure(listed)) {
    throw listed.error;
  }
  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  if (!(QueryResult.isSuccess(listed) && QueryResult.isSuccess(classes))) {
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
  const shown = studentShown({
    classes: classes.value.length,
    finished: finished.length,
    hasNow: Option.isSome(next),
    upcoming: upcoming.length,
  });
  const cells = placeCells([
    {
      draw: (span) =>
        Option.match(next, {
          onNone: () => null,
          onSome: (sitting) => <NowCell sitting={sitting} span={span} />,
        }),
      key: "now",
      narrow: 2,
      shown: shown.now,
      wide: 8,
    },
    {
      draw: (span) => <ClassesCell classes={classes.value} span={span} />,
      key: "classes",
      narrow: 2,
      shown: shown.classes,
      wide: 4,
    },
    {
      draw: (span) => (
        <ScheduleCell
          bound={null}
          items={Arr.map(upcoming, (sitting) =>
            scheduleItemOf(sitting, tenant.slug)
          )}
          span={span}
        />
      ),
      key: "schedule",
      narrow: 2,
      shown: shown.schedule,
      wide: 4,
    },
    {
      draw: (span) => (
        <StudentResultsCell
          bound={reachesBound(finished.length, HOME_RESULT_LIMIT)}
          sittings={finished}
          span={span}
        />
      ),
      key: "results",
      narrow: 1,
      shown: shown.results,
      wide: 4,
    },
    {
      draw: (span) => <QuietCell span={span} />,
      key: "quiet",
      narrow: 2,
      shown: shown.quiet,
      wide: 12,
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

/** A sitting as a schedule row, which opens the sitting for the student and says what the sitting is now. */
function scheduleItemOf(sitting: Sitting, slug: TenantSlug): ScheduleItem {
  return {
    target: schoolSittingTarget(slug, sitting.id),
    id: sitting.id,
    opensAt: sitting.opensAt,
    room: sitting.room,
    timeZone: sitting.timeZone,
    title: sitting.examTitle,
    trailing: <SittingStatus sitting={sitting} />,
  };
}

/**
 * What a sitting is now, as the text at the end of its row: whether the student's answers are saved, that it is open,
 * or the time it opens.
 */
function SittingStatus({ sitting }: { sitting: Sitting }) {
  const t = useTranslations("School");
  const locale = useLocale();

  if (sitting.state === "open") {
    return sitting.attempt === "submitted"
      ? t("answers-saved")
      : t("sitting-open-now");
  }
  return schoolDayTimeText({
    at: sitting.opensAt,
    locale,
    timeZone: sitting.timeZone,
  });
}

/**
 * The sitting that is open now, with the minutes left before it closes, or the next sitting, with the minutes until it
 * opens and its time at the end of its row. Its row opens the sitting. The cell keeps one structure in both states, so
 * it does not change height when the sitting opens.
 */
function NowCell({ sitting, span }: { sitting: Sitting; span: CellSpan }) {
  const tenant = useTenant();
  const t = useTranslations("School");
  const now = useHomeNow();
  const open = sitting.state === "open";
  const left = minutesLeft(open ? sitting.closesAt : sitting.opensAt, now);

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-now")} />
      <Dashboard.Value>{left}</Dashboard.Value>
      <Dashboard.Period>
        {open
          ? t("now-left", { count: left })
          : t("now-until-open", { count: left })}
      </Dashboard.Period>
      <Dashboard.List>
        <Dashboard.Row
          detail={sitting.room}
          render={
            <TargetLink
              target={schoolSittingTarget(tenant.slug, sitting.id)}
              title={sitting.examTitle}
            />
          }
          title={sitting.examTitle}
          trailing={open ? undefined : <SittingStatus sitting={sitting} />}
        />
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/**
 * The results of the sittings that closed, newest first, each with the student's score once it is released. A list
 * that reached its bound says so, because the student's older results are not listed.
 */
function StudentResultsCell({
  bound,
  sittings,
  span,
}: {
  bound: boolean;
  sittings: readonly Sitting[];
  span: CellSpan;
}) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-results")} />
      <Dashboard.List>
        {Arr.map(sittings, (sitting) => (
          <StudentResultRow key={sitting.id} sitting={sitting} />
        ))}
      </Dashboard.List>
      {bound ? (
        <Dashboard.Period>
          {t("results-bound", { count: HOME_RESULT_LIMIT })}
        </Dashboard.Period>
      ) : null}
    </Dashboard.Cell>
  );
}

/** One closed sitting, as a row that opens it, with the student's score as its end text once it is released. */
function StudentResultRow({ sitting }: { sitting: Sitting }) {
  const tenant = useTenant();
  const t = useTranslations("School");
  const te = useTranslations("Exams");

  return (
    <Dashboard.Row
      detail={sitting.room}
      render={
        <TargetLink
          target={schoolSittingTarget(tenant.slug, sitting.id)}
          title={sitting.examTitle}
        />
      }
      title={sitting.examTitle}
      trailing={
        sitting.score === null
          ? t("answers-saved")
          : te("student-score", {
              points: sitting.score.points,
              total: sitting.score.total,
            })
      }
    />
  );
}

/** The quiet state of a student who has no sitting and no result yet: the schedule's card, titled as the schedule is. */
function QuietCell({ span }: { span: CellSpan }) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-schedule")} />
      <Dashboard.Empty act="searching">{t("sittings-empty")}</Dashboard.Empty>
    </Dashboard.Cell>
  );
}
