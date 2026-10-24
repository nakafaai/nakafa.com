import {
  HOME_DRAFT_LIMIT,
  HOME_RESULT_LIMIT,
  HOME_ROOM_LIMIT,
} from "@repo/backend/confect/exams/home/bounds";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Link } from "@repo/internationalization/src/link";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { countLabel } from "@/components/tenant/home/count";

/** The rooms of the staff home's lists, which the strip counts. */
type Rooms = (typeof HomeView.Type)["live"];

/** The closed sittings of the staff home, which the strip counts for their release. */
type Closed = (typeof HomeView.Type)["closed"];

/** The drafts of the staff home, which the strip counts. */
type Drafts = (typeof HomeView.Type)["drafts"];

/**
 * The strip of four numbers at the top of a staff home: the rooms that run now, the rooms that open within fourteen
 * days, the closed sittings that wait for their release, and the drafts. Each number is the length of the list it
 * counts, and a list that its read bounds reads with a plus sign once the bound is reached. Each cell links to the
 * exams list, where those rooms, results and drafts live.
 */
export function HomeMetrics({
  closed,
  drafts,
  live,
  next,
}: {
  closed: Closed;
  drafts: Drafts;
  live: Rooms;
  next: Rooms;
}) {
  const t = useTranslations("School");
  const waiting = Arr.filter(closed, (result) => result.canRelease).length;

  return (
    <Dashboard columns="four">
      <MetricCell
        count={countLabel(live.length, live.length, HOME_ROOM_LIMIT)}
        period={t("metric-live-period")}
        title={t("metric-live")}
      />
      <MetricCell
        count={countLabel(next.length, next.length, HOME_ROOM_LIMIT)}
        period={t("metric-next-period")}
        title={t("metric-next")}
      />
      <MetricCell
        count={countLabel(waiting, closed.length, HOME_RESULT_LIMIT)}
        period={t("metric-waiting-period")}
        title={t("metric-waiting")}
      />
      <MetricCell
        count={countLabel(drafts.length, drafts.length, HOME_DRAFT_LIMIT)}
        period={t("metric-drafts-period")}
        title={t("metric-drafts")}
      />
    </Dashboard>
  );
}

/** One number of the strip, as a cell that links to the exams list. */
function MetricCell({
  count,
  period,
  title,
}: {
  count: string;
  period: string;
  title: string;
}) {
  const { slug } = useTenant();

  return (
    <Dashboard.Cell
      render={<Link params={{ slug }} to="/school/$slug/exams" />}
    >
      <Dashboard.CellHeader title={title} />
      <Dashboard.Value>{count}</Dashboard.Value>
      <Dashboard.Period>{period}</Dashboard.Period>
    </Dashboard.Cell>
  );
}
