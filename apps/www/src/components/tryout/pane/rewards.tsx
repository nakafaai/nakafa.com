import { StarIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { AWARD_RULES } from "@repo/backend/confect/progress/schema";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { medalsOf } from "@/components/progress/level";
import { MedalItem, MedalWay } from "@/components/progress/medal";
import { PaneSection } from "@/components/progress/section";
import { useSetPane } from "@/components/tryout/pane/context";
import { starsLeft } from "@/components/tryout/pane/model";

/** A grant's Stars: what it gives, or, once held, the same amount quiet behind a tick. */
const amountVariants = cva(
  "inline-flex items-center justify-end gap-1.5 text-sm tabular-nums",
  { variants: { held: { false: "", true: "text-muted-foreground" } } }
);

/** One grant of the set: what earns it, and its Stars. */
function Grant({
  held,
  label,
  stars,
}: {
  held: boolean;
  label: string;
  stars: number;
}) {
  return (
    <>
      <dt className="truncate text-sm">{label}</dt>
      <dd className={amountVariants({ held })}>
        {held ? (
          <HugeIcons className="text-success" icon={Tick02Icon} size="sm" />
        ) : null}
        +{stars}
      </dd>
    </>
  );
}

/** A medal the set counts toward, as the profile's wall draws it, with what the set adds on its way. */
function SetMedal({ gain, name }: { gain: number; name: "sections" | "sets" }) {
  const { tally } = useSetPane();
  return Option.match(
    Arr.findFirst(medalsOf(tally), (medal) => medal.name === name),
    {
      onNone: () => null,
      onSome: (medal) => (
        <MedalItem medal={medal}>
          <MedalWay gain={gain} medal={medal} />
        </MedalItem>
      ),
    }
  );
}

/**
 * What the set gives (the owner's notes of 20 Nov): its Stars, a grant for its parts and one for finishing it,
 * each ticked once the learner holds it, and the two medals it counts toward with what it adds to them. Its
 * badge says the Stars still to earn, or that the learner holds them all.
 */
export function SetRewards() {
  const t = useTranslations("Tryouts");
  const tProgress = useTranslations("Progress");
  const format = useFormatter();
  const { claims, sections, view } = useSetPane();
  const keys = Arr.map(sections, (section) => section.sectionKey);
  const left = starsLeft(keys, claims);
  const entered = view.entrySection?.visibility === "internal-entry";
  const held = Arr.countBy(keys, (key) => Arr.contains(claims.sections, key));

  return (
    <PaneSection
      action={
        left > 0 ? (
          <Badge variant="outline">
            <HugeIcons
              className="fill-pop-yellow text-pop-yellow"
              data-icon="inline-start"
              icon={StarIcon}
            />
            {tProgress("stars", { stars: format.number(left) })}
          </Badge>
        ) : (
          <Badge variant="muted">
            <HugeIcons data-icon="inline-start" icon={Tick02Icon} />
            {t("rewards-held")}
          </Badge>
        )
      }
      title={t("rewards-title")}
    >
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
        <Grant
          held={held === keys.length}
          label={
            entered
              ? t("reward-paper")
              : t("reward-sections", { count: keys.length })
          }
          stars={keys.length * AWARD_RULES.section.stars}
        />
        <Grant
          held={claims.set}
          label={t("set-done")}
          stars={AWARD_RULES.set.stars}
        />
      </dl>
      <ul className="grid grid-cols-2 gap-x-3">
        <SetMedal gain={claims.set ? 0 : 1} name="sets" />
        <SetMedal gain={keys.length - held} name="sections" />
      </ul>
    </PaneSection>
  );
}
