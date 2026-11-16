import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { bestOf, wallOf } from "@/components/progress/level";
import { MedalItem } from "@/components/progress/medal";
import { PaneSection } from "@/components/progress/section";
import { profileTabTarget } from "@/lib/profile/href";
import { TargetLink } from "@/lib/routing/link";

/** How many medals the pane shows: one row, so the leaderboard under it stays in sight. */
const SHOWN = 4;

/** See all: the learner's own profile, where every medal stands and anyone they send it to can see them. */
function BadgesMore({ username }: { username: string }) {
  const t = useTranslations("Home");
  return (
    <TargetLink
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      target={profileTabTarget("badges", username)}
    >
      {t("more")}
      <HugeIcons icon={ArrowRight01Icon} />
    </TargetLink>
  );
}

/**
 * The learner's best medals in the world pane (the owner's home notes, 14
 * Nov): one row of four, so the pane never fills with a wall that has no end.
 * The whole wall is on their profile, one press away.
 */
export function BadgesSection() {
  const t = useTranslations("Island");
  const { island, username } = useProgress();
  return (
    <PaneSection
      action={Option.match(username, {
        onNone: () => null,
        onSome: (name) => <BadgesMore username={name} />,
      })}
      title={t("badges-title")}
    >
      <ul className="grid grid-cols-4 gap-x-3">
        {Arr.map(bestOf(wallOf(island.tally), SHOWN), (medal) => (
          <MedalItem key={medal.name} medal={medal} />
        ))}
      </ul>
    </PaneSection>
  );
}
