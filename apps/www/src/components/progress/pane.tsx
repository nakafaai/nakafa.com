import { PlayIcon, Share08Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { BadgesSection } from "@/components/progress/badges";
import { useProgress } from "@/components/progress/context";
import { LeadersSection } from "@/components/progress/leaders";
import { LevelMeter } from "@/components/progress/meter";
import { PaneSection } from "@/components/progress/section";
import { WorldCard } from "@/components/progress/world";
import {
  PaneBody,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/page/pane";
import { PagePane } from "@/components/shared/page/panes";
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * The learner's world beside the page (the owner's home notes, 14 Nov): its
 * header reads the island's level over the bar toward the next one, as a game
 * does; then three parts with a line across the pane between them, the world,
 * the best medals and the global leaderboard; and a footer to share the world
 * or open it. On a wide screen it always stands beside the
 * page, so it draws no close button; on a phone the tracker's Your world
 * button opens it as a sheet.
 */
export function WorldPane() {
  const t = useTranslations("Island");
  const { island } = useProgress();
  return (
    <PagePane alwaysOn label={t("world-title")}>
      <PaneHeader
        description={<LevelMeter />}
        title={t("level", { level: island.level })}
      />
      <PaneBody>
        <PaneSection title={t("world-title")}>
          <WorldCard />
        </PaneSection>
        <BadgesSection />
        <LeadersSection />
      </PaneBody>
      <PaneFooter>
        <ButtonGroup>
          <WorldShare />
          <WorldOpen />
        </ButtonGroup>
      </PaneFooter>
    </PagePane>
  );
}

/** Copies a link to the game with the learner's level, to send to a friend. */
function WorldShare() {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const locale = useCurrentLocale();
  const clipboard = useClipboard({ timeout: 1000 });
  const { island } = useProgress();
  return (
    <Button
      onClick={() => {
        const link = new URL(`/${locale}/island`, SITE_ORIGIN).toString();
        clipboard.copy(`${t("share-text", { level: island.level })} ${link}`);
        toast.success(
          { title: "link-copied.title" },
          { position: "bottom-center" }
        );
      }}
    >
      <HugeIcons icon={Share08Icon} />
      {tCommon("share")}
    </Button>
  );
}

/** Enters the game. It stands with Share in one group at the footer's end, so the two are never far apart. */
function WorldOpen() {
  const t = useTranslations("Island");
  const locale = useCurrentLocale();
  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      params={{ locale }}
      to="/$locale/island"
    >
      <HugeIcons icon={PlayIcon} />
      {t("open")}
    </Link>
  );
}
