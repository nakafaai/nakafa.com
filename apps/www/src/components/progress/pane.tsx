import { PlayIcon, Share08Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { BadgesCard } from "@/components/progress/badges";
import { useProgress } from "@/components/progress/context";
import { LeadersCard } from "@/components/progress/leaders";
import { WorldCard } from "@/components/progress/world";
import { PaneBody, PaneFooter, PaneHeader } from "@/components/shared/pane";
import { PanesDetail, usePanes } from "@/components/shared/panes";
import { useCurrentLocale } from "@/lib/routing/link";

/** The ID the world pane opens under in the page's panes. */
export const WORLD_PANE = "world";

/**
 * The learner's world beside the page (the owner's home sketch, 13 Nov): its
 * title and how far the next level is, the world, the badges still to earn,
 * the global leaderboard, and a footer to share it or to open the game. It
 * opens and closes with the header's Your world button.
 */
export function WorldPane() {
  const t = useTranslations("Island");
  const { island } = useProgress();
  return (
    <PanesDetail label={t("world-title")}>
      <PaneHeader
        description={
          island.next === undefined
            ? t("top")
            : t("next", {
                level: island.level + 1,
                stars: island.next - island.lifetime,
              })
        }
        title={t("world-title")}
      />
      <PaneBody>
        <div className="flex flex-col gap-4">
          <WorldCard />
          <BadgesCard />
          <LeadersCard />
        </div>
      </PaneBody>
      <PaneFooter>
        <WorldShare />
        <WorldOpen />
      </PaneFooter>
    </PanesDetail>
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
      variant="outline"
    >
      <HugeIcons icon={Share08Icon} />
      {tCommon("share")}
    </Button>
  );
}

/** Enters the game, the pane's one primary action. */
function WorldOpen() {
  const t = useTranslations("Island");
  const locale = useCurrentLocale();
  return (
    <Link className={buttonVariants()} params={{ locale }} to="/$locale/island">
      <HugeIcons icon={PlayIcon} />
      {t("open")}
    </Link>
  );
}

/**
 * The header's Your world button (the owner's home sketch, 13 Nov): it opens
 * the world pane, or its sheet on a phone, and closes it again.
 */
export function WorldToggle() {
  const t = useTranslations("Island");
  const open = usePanes((state) => Option.isSome(state.open));
  const show = usePanes((state) => state.show);
  const close = usePanes((state) => state.close);
  return (
    <Button
      aria-pressed={open}
      onClick={() => (open ? close() : show(WORLD_PANE))}
      variant="outline"
    >
      {t("world-title")}
    </Button>
  );
}

/** The Your world button a try-out pane's footer holds: it enters the game (the owner's try-out sketches, 13 Nov). */
export function WorldLink() {
  const t = useTranslations("Island");
  const locale = useCurrentLocale();
  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      params={{ locale }}
      to="/$locale/island"
    >
      <HugeIcons icon={PlayIcon} />
      {t("world-title")}
    </Link>
  );
}
