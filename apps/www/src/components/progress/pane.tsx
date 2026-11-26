import { useTranslations } from "use-intl";
import { BadgesSection } from "@/components/progress/badges";
import { useProgress } from "@/components/progress/context";
import { LeadersSection } from "@/components/progress/leaders";
import { LevelMeter } from "@/components/progress/meter";
import { PaneBody, PaneHeader } from "@/components/shared/page/pane";
import { PagePane } from "@/components/shared/page/panes";

/**
 * The learner's progress pane beside the home page: its header reads their
 * level over the bar toward the next one, followed by their best medals and
 * the global leaderboard. On a wide screen it always stands beside the page;
 * on a phone the tracker's Progress button opens it as a sheet.
 */
export function ProgressPane() {
  const t = useTranslations("Progress");
  const { growth } = useProgress();
  return (
    <PagePane alwaysOn label={t("title")}>
      <PaneHeader
        description={<LevelMeter />}
        title={t("level", { level: growth.level })}
      />
      <PaneBody>
        <BadgesSection />
        <LeadersSection />
      </PaneBody>
    </PagePane>
  );
}
