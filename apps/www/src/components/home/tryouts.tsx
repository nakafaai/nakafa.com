import type { Ref } from "@confect/core";
import {
  CheckmarkCircle02Icon,
  PlayIcon,
  TimeQuarterPassIcon,
} from "@hugeicons/core-free-icons";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { SectionDoor, SectionMore } from "@/components/home/row";
import { HomeSection } from "@/components/home/section";
import { getPrimaryNavigationItems } from "@/components/sidebar/data/navigation";
import { TryoutPageLink } from "@/components/tryout/route/link";

/** The sidebar's Try-out entry, which this section leads to. */
const [, TRYOUT] = getPrimaryNavigationItems();

/** The icon of an attempt by how it stands: still running, finished, or out of time. */
const STATUS_ICONS = {
  completed: CheckmarkCircle02Icon,
  expired: TimeQuarterPassIcon,
  "in-progress": PlayIcon,
} as const;

type Attempt = Ref.Returns<typeof tryouts.queries.history.recent>[number];

/** One try-out the learner sat: its set, and one line on how it stands. The row opens that attempt. */
function AttemptRow({ attempt }: { attempt: Attempt }) {
  const t = useTranslations("Home");
  const format = useFormatter();
  let line = t("tryout-expired");
  if (attempt.status === "in-progress") {
    line = t("tryout-running");
  } else if (attempt.score !== null) {
    line = t("tryout-score", { score: format.number(attempt.score) });
  }
  return (
    <TryoutPageLink
      attemptId={attempt.attemptId}
      className="group hover:bg-accent hover:text-accent-foreground flex items-start gap-3 p-4 transition-colors ease-out"
      publicPath={attempt.publicPath}
    >
      <Tile seed={attempt.publicPath}>
        <TileIcon icon={STATUS_ICONS[attempt.status]} />
      </Tile>
      <div className="-mt-1 flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="truncate">{attempt.title}</h3>
        <span className="text-muted-foreground group-hover:text-accent-foreground truncate text-sm">
          {line}
        </span>
      </div>
    </TryoutPageLink>
  );
}

/**
 * The home's second section (the owner's home notes, 14 Nov): the try-outs
 * the learner sat last, newest first, each row opening its attempt to go on
 * or to read the result. A learner who has sat none gets one row that
 * leads to the try-outs in their place.
 */
export function HomeTryouts({ attempts }: { attempts: readonly Attempt[] }) {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  return (
    <HomeSection
      action={<SectionMore item={TRYOUT} />}
      title={tCommon("try-out")}
    >
      {attempts.length === 0 ? (
        <SectionDoor item={TRYOUT} sentence={t("tryouts-first")} />
      ) : (
        Arr.map(attempts, (attempt) => (
          <AttemptRow attempt={attempt} key={attempt.attemptId} />
        ))
      )}
    </HomeSection>
  );
}
