import { QueryResult } from "@confect/react";
import {
  HOME_RESULT_LIMIT,
  HOME_ROOM_LIMIT,
} from "@repo/backend/confect/exams/home/bounds";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { Fragment } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { type CellSpan, placeCells } from "@/components/tenant/home/cells";
import { ClassesCell } from "@/components/tenant/home/classes";
import { reachesBound } from "@/components/tenant/home/count";
import { DraftsCell } from "@/components/tenant/home/drafts";
import { LiveCell } from "@/components/tenant/home/live";
import { useHomeExams, useHomeSetup } from "@/components/tenant/home/query";
import { ResultsCell } from "@/components/tenant/home/results";
import {
  ScheduleCell,
  type ScheduleItem,
} from "@/components/tenant/home/schedule";
import { SetupCell, useSetupShown } from "@/components/tenant/home/setup";
import { staffShown } from "@/components/tenant/home/shown";
import { schoolDayTimeText } from "@/components/tenant/settings/clock";
import { schoolExamSittingTarget } from "@/lib/routing/school/target";

/** A room that the staff home lists as upcoming. */
type Room = (typeof HomeView.Type)["next"][number];

/**
 * The cards of a staff home, each card one concern: the viewer's classes first, then the rooms, the results, the
 * drafts and the setup. One read brings the rooms, the results, and the drafts, the classes come from the viewer's
 * classes read, and the setup cell reads the school's setup on its own. Until the reads that the cells need have
 * answered, nothing shows below the header's row of shortcuts, and then every cell appears at once, so no cell that is
 * shown moves when another arrives. The cells lay out in rows that fill the dashboard at each width, so a cell that is
 * not shown leaves no gap.
 */
export function StaffHome() {
  const tenant = useTenant();
  const exams = useHomeExams();
  const classes = useMyClasses();
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  const setupShown = useSetupShown();
  const locale = useLocale();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  // A failed read counts as an answer, because its cell shows its own failure. The owner's and the admin's setup
  // also waits for the viewer's units, which decide its first step.
  const setupAnswered =
    QueryResult.isSuccess(setup) || QueryResult.isFailure(setup);
  const viewerAnswered =
    QueryResult.isSuccess(viewer) || QueryResult.isFailure(viewer);
  const ready =
    QueryResult.isSuccess(exams) &&
    QueryResult.isSuccess(classes) &&
    (!tenant.canManage || (setupAnswered && viewerAnswered));
  if (!ready) {
    return null;
  }
  const { closed, drafts: draftRows, live, next } = exams.value;
  const classRows = QueryResult.isSuccess(classes) ? classes.value : [];
  const shown = staffShown({
    canCreate: tenant.home.canCreate,
    canWatch: tenant.home.canWatch,
    classes: classRows.length,
    closed: closed.length,
    drafts: draftRows.length,
    live: live.length,
    next: next.length,
    setupShown,
  });
  const nextBound = reachesBound(next.length, HOME_ROOM_LIMIT);
  const closedBound = reachesBound(closed.length, HOME_RESULT_LIMIT);
  const cells = placeCells([
    {
      draw: (span) => <ClassesCell classes={classRows} span={span} />,
      key: "classes",
      narrow: 2,
      shown: shown.classes,
      wide: 8,
    },
    {
      draw: (span) => (
        <ScheduleCell
          bound={nextBound ? HOME_ROOM_LIMIT : null}
          items={Arr.map(next, (room) =>
            scheduleItemOf(room, locale, tenant.slug)
          )}
          span={span}
        />
      ),
      key: "schedule",
      narrow: 2,
      shown: shown.schedule,
      wide: 8,
    },
    {
      draw: (span) => <LiveCell rooms={live} span={span} />,
      key: "live",
      narrow: 1,
      shown: shown.live,
      wide: 4,
    },
    {
      draw: (span) => <QuietCell span={span} />,
      key: "quiet",
      narrow: 2,
      shown: shown.quiet,
      wide: 8,
    },
    {
      draw: (span) => (
        <ResultsCell bound={closedBound} results={closed} span={span} />
      ),
      key: "results",
      narrow: 1,
      shown: shown.results,
      wide: 8,
    },
    {
      draw: (span) => <DraftsCell drafts={draftRows} span={span} />,
      key: "drafts",
      narrow: 1,
      shown: shown.drafts,
      wide: 4,
    },
    {
      draw: (span) => <SetupCell span={span} />,
      key: "setup",
      narrow: 2,
      shown: shown.setup,
      wide: 12,
    },
  ]);

  if (Arr.isReadonlyArrayEmpty(cells)) {
    return null;
  }
  return (
    <Dashboard>
      {Arr.map(cells, (cell) => (
        <Fragment key={cell.key}>{cell.draw(cell)}</Fragment>
      ))}
    </Dashboard>
  );
}

/** The room of the schedule, which its bar and its row open at the room's proctor page, and says when it opens. */
function scheduleItemOf(
  room: Room,
  locale: string,
  slug: TenantSlug
): ScheduleItem {
  return {
    target: schoolExamSittingTarget(slug, room.examId, room.id),
    id: room.id,
    opensAt: room.opensAt,
    room: room.room,
    timeZone: room.timeZone,
    title: room.examTitle,
    trailing: schoolDayTimeText({
      at: room.opensAt,
      locale,
      timeZone: room.timeZone,
    }),
  };
}

/**
 * The quiet state of a staff home: the schedule's card, titled as the schedule is, which takes the place of the
 * schedule and the rooms while none run or open soon.
 */
function QuietCell({ span }: { span: CellSpan }) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-schedule")} />
      <Dashboard.Empty act="sleeping">{t("quiet-staff")}</Dashboard.Empty>
    </Dashboard.Cell>
  );
}
