import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import { type CellSpan, placeCells } from "@/components/tenant/home/cells";
import { useHomeNow } from "@/components/tenant/home/clock";
import { DraftsCell } from "@/components/tenant/home/drafts";
import { LiveCell } from "@/components/tenant/home/live";
import { HomeMetrics } from "@/components/tenant/home/metrics";
import { useHomeExams, useHomeSetup } from "@/components/tenant/home/query";
import { ResultsCell } from "@/components/tenant/home/results";
import { ScheduleCell } from "@/components/tenant/home/schedule";
import { SetupCell, useSetupShown } from "@/components/tenant/home/setup";
import { staffShown } from "@/components/tenant/home/shown";
import type { ScheduleRoom } from "@/components/tenant/home/strip";
import { scheduleDays } from "@/components/tenant/home/strip";

/** The rooms of the staff home, which the schedule draws. */
type Room = (typeof HomeView.Type)["next"][number];

/**
 * The strip of numbers and the cells of a staff home. One read brings the rooms, the results, and the drafts, and
 * the setup cell reads the school's setup on its own. Until the reads that the cells need have answered, nothing
 * shows below the header, and then every cell appears at once, so no cell that is shown moves when another arrives.
 * The cells lay out in rows that fill the grid at each width, so a cell that is not shown leaves no gap.
 */
export function StaffHome({ drafts }: { drafts: StoreApi<ExamDrafts> }) {
  const tenant = useTenant();
  const exams = useHomeExams();
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  const setupShown = useSetupShown();
  const now = useHomeNow();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  // A failed read counts as an answer, because its cell shows its own failure. The owner's and the admin's setup
  // also waits for the viewer's units, which decide its first step.
  const setupAnswered =
    QueryResult.isSuccess(setup) || QueryResult.isFailure(setup);
  const viewerAnswered =
    QueryResult.isSuccess(viewer) || QueryResult.isFailure(viewer);
  const ready =
    QueryResult.isSuccess(exams) &&
    (!tenant.canManage || (setupAnswered && viewerAnswered));
  if (!ready) {
    return null;
  }
  const { closed, drafts: draftRows, live, next } = exams.value;
  const days = scheduleDays(Arr.map(next, scheduleRoomOf), now);
  const shown = staffShown({
    canCreate: tenant.home.canCreate,
    canWatch: tenant.home.canWatch,
    closed: closed.length,
    drafts: draftRows.length,
    live: live.length,
    next: next.length,
    setupShown,
  });
  const cells = placeCells([
    {
      draw: (span) => <ScheduleCell days={days} span={span} />,
      key: "schedule",
      shown: shown.schedule,
      three: 2,
      two: 2,
    },
    {
      draw: (span) => <LiveCell now={now} rooms={live} span={span} />,
      key: "live",
      shown: shown.live,
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
    {
      draw: (span) => <ResultsCell results={closed} span={span} />,
      key: "results",
      shown: shown.results,
      three: 2,
      two: 1,
    },
    {
      draw: (span) => (
        <DraftsCell drafts={draftRows} now={now} span={span} store={drafts} />
      ),
      key: "drafts",
      shown: shown.drafts,
      three: 1,
      two: 1,
    },
    {
      draw: (span) => <SetupCell span={span} />,
      key: "setup",
      shown: shown.setup,
      three: 3,
      two: 2,
    },
  ]);

  return (
    <>
      {tenant.home.canWatch || tenant.home.canCreate ? (
        <HomeMetrics
          closed={closed}
          drafts={draftRows}
          live={live}
          next={next}
        />
      ) : null}
      {Arr.isReadonlyArrayEmpty(cells) ? null : (
        <Dashboard>
          {Arr.map(cells, (cell) => (
            <Fragment key={cell.key}>{cell.draw(cell)}</Fragment>
          ))}
        </Dashboard>
      )}
    </>
  );
}

/** The schedule's room of one room that the home lists, which its bar opens at the exam's proctor page. */
function scheduleRoomOf(room: Room): ScheduleRoom {
  return {
    href: `/exams/${room.examId}`,
    id: room.id,
    opensAt: room.opensAt,
    room: room.room,
    timeZone: room.timeZone,
    title: room.examTitle,
  };
}

/** The quiet state of a staff home, which takes the place of the schedule and the rooms while none run or open soon. */
function QuietCell({ span }: { span: CellSpan }) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.Empty act="sleeping">{t("quiet-staff")}</Dashboard.Empty>
    </Dashboard.Cell>
  );
}
