import { QueryResult } from "@confect/react";
import {
  HOME_RESULT_LIMIT,
  HOME_ROOM_LIMIT,
} from "@repo/backend/confect/exams/home/bounds";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr, Option } from "effect";
import { Fragment } from "react";
import { useLocale, useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import { type CellSpan, placeCells } from "@/components/tenant/home/cells";
import { countLabel, reachesBound } from "@/components/tenant/home/count";
import { DraftsCell } from "@/components/tenant/home/drafts";
import { LiveCell } from "@/components/tenant/home/live";
import { MetricCell } from "@/components/tenant/home/metrics";
import { useHomeExams, useHomeSetup } from "@/components/tenant/home/query";
import type { HomeReleases } from "@/components/tenant/home/release";
import { ResultsCell } from "@/components/tenant/home/results";
import {
  ScheduleCell,
  type ScheduleItem,
} from "@/components/tenant/home/schedule";
import { SetupCell, useSetupShown } from "@/components/tenant/home/setup";
import { staffShown } from "@/components/tenant/home/shown";
import { waitingOf } from "@/components/tenant/home/waiting";
import { schoolWeekdayTimeText } from "@/components/tenant/settings/clock";
import { schoolExamSittingTarget } from "@/lib/routing/school/target";

/** A room that the staff home lists as upcoming. */
type Room = (typeof HomeView.Type)["next"][number];

/**
 * The row of four numbers and the cards of a staff home, each card one concern. One read brings the rooms, the
 * results, and the drafts, and the setup cell reads the school's setup on its own. Until the reads that the cells need
 * have answered, nothing shows below the header, and then every cell appears at once, so no cell that is shown moves
 * when another arrives. The cells lay out in rows that fill the dashboard at each width, so a cell that is not shown
 * leaves no gap.
 */
export function StaffHome({
  drafts,
  releases,
}: {
  drafts: StoreApi<ExamDrafts>;
  releases: StoreApi<HomeReleases>;
}) {
  const tenant = useTenant();
  const exams = useHomeExams();
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  const setupShown = useSetupShown();
  const locale = useLocale();
  const t = useTranslations("School");

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
  const { closed, drafts: draftRows, draftsBounded, live, next } = exams.value;
  const shown = staffShown({
    canCreate: tenant.home.canCreate,
    canWatch: tenant.home.canWatch,
    closed: closed.length,
    drafts: draftRows.length,
    live: live.length,
    next: next.length,
    setupShown,
  });
  const nextBound = reachesBound(next.length, HOME_ROOM_LIMIT);
  // The numbers pair up on a phone; an odd last number takes its row alone.
  const counts = Arr.filter(
    ["count-live", "count-next", "count-waiting", "count-drafts"] as const,
    (key) => shown[key]
  );
  const paired = (key: (typeof counts)[number]) =>
    counts.length % 2 === 0 ||
    Arr.last(counts).pipe(Option.exists((last) => last !== key));
  const closedBound = reachesBound(closed.length, HOME_RESULT_LIMIT);
  const cells = placeCells([
    {
      draw: (span) => (
        <MetricCell
          count={countLabel(
            live.length,
            reachesBound(live.length, HOME_ROOM_LIMIT)
          )}
          pair={paired("count-live")}
          period={t("metric-live-period")}
          span={span}
          title={t("metric-live")}
        />
      ),
      key: "count-live",
      narrow: 1,
      shown: shown["count-live"],
      wide: 3,
    },
    {
      draw: (span) => (
        <MetricCell
          count={countLabel(next.length, nextBound)}
          pair={paired("count-next")}
          period={t("metric-next-period")}
          span={span}
          title={t("metric-next")}
        />
      ),
      key: "count-next",
      narrow: 1,
      shown: shown["count-next"],
      wide: 3,
    },
    {
      draw: (span) => (
        <MetricCell
          count={countLabel(waitingOf(closed), closedBound)}
          pair={paired("count-waiting")}
          period={t("metric-waiting-period")}
          span={span}
          title={t("metric-waiting")}
        />
      ),
      key: "count-waiting",
      narrow: 1,
      shown: shown["count-waiting"],
      wide: 3,
    },
    {
      draw: (span) => (
        <MetricCell
          count={countLabel(draftRows.length, draftsBounded)}
          pair={paired("count-drafts")}
          period={t("metric-drafts-period")}
          span={span}
          title={t("metric-drafts")}
        />
      ),
      key: "count-drafts",
      narrow: 1,
      shown: shown["count-drafts"],
      wide: 3,
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
        <ResultsCell
          bound={closedBound}
          releases={releases}
          results={closed}
          span={span}
        />
      ),
      key: "results",
      narrow: 1,
      shown: shown.results,
      wide: 8,
    },
    {
      draw: (span) => (
        <DraftsCell drafts={draftRows} span={span} store={drafts} />
      ),
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
    trailing: schoolWeekdayTimeText({
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
