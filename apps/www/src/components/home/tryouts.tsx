import type { Ref } from "@confect/core";
import {
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  PlayIcon,
  RepeatIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { buttonVariants } from "@repo/design-system/lib/button";
import { rowLinkVariants } from "@repo/design-system/lib/row";
import { cn } from "cn";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { SectionMore } from "@/components/home/row";
import { HomeSection } from "@/components/home/section";
import { useNow } from "@/components/player/now";
import { CountryFlagIcon } from "@/components/shared/flag";
import {
  getPrimaryNavigationItems,
  getPrimaryNavigationTarget,
} from "@/components/sidebar/data/navigation";
import {
  TRYOUT_EXAM_ICONS,
  TRYOUT_SUBJECT_ICONS,
} from "@/components/tryout/catalog/icons";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { TryoutClock } from "@/components/tryout/runtime/countdown";
import type { TryoutStart } from "@/lib/account/start";
import { TargetLink } from "@/lib/routing/link";

/** The sidebar's Try-out entry, which this section leads to. */
const [, TRYOUT] = getPrimaryNavigationItems();

/** How many tiles the folded row stacks; its count names the rest. */
const STACKED = 3;

type Attempt = Ref.Returns<typeof tryouts.queries.history.recent>[number];

/** The picture of a try-out: the part it runs on, or its exam. */
function iconOf(attempt: Attempt): IconSvgElement {
  const part = Option.flatMap(Option.fromNullishOr(attempt.part), (running) =>
    Rec.get(TRYOUT_SUBJECT_ICONS, running.key)
  );
  return Option.getOrElse(
    Option.orElse(part, () => Rec.get(TRYOUT_EXAM_ICONS, attempt.examKey)),
    () => TRYOUT_EXAM_ICONS.snbt
  );
}

/**
 * The tile of a try-out, with its country's flag at its corner, so two exams of one name in two countries
 * never read the same. A set that ran out of time loses its colour, so it reads as over before a word is
 * read; its flag keeps its own, since a grey flag reads as another country.
 */
function TryoutTile({ attempt }: { attempt: Attempt }) {
  return (
    <span className="relative shrink-0">
      <Tile
        className={cn(attempt.status === "expired" && "grayscale")}
        seed={attempt.part?.key ?? attempt.publicPath}
      >
        <TileIcon icon={iconOf(attempt)} />
      </Tile>
      <span className="ring-card after:ring-foreground/10 absolute -end-1 -bottom-1 flex size-4 overflow-hidden rounded-full ring-2 after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-inset">
        <CountryFlagIcon
          className="h-4 w-6 max-w-none shrink-0 -translate-x-1"
          countryCode={attempt.countryCode}
        />
      </span>
    </span>
  );
}

/**
 * The share of a running set's time still left, as a ring that empties as the clock runs, beside the
 * clock that counts it.
 */
function TimeRing({ attempt }: { attempt: Attempt }) {
  const now = useNow(true);
  const whole = Math.max(1, attempt.expiresAt - attempt.startedAt);
  const left = Math.min(1, Math.max(0, (attempt.expiresAt - now) / whole));
  const length = 2 * Math.PI * 6;
  return (
    <svg aria-hidden className="size-4 shrink-0 -rotate-90" viewBox="0 0 16 16">
      <circle
        className="stroke-muted"
        cx="8"
        cy="8"
        fill="none"
        r="6"
        strokeWidth="2.5"
      />
      <circle
        className="stroke-info transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
        cx="8"
        cy="8"
        fill="none"
        r="6"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - left)}
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

/** One fact under a try-out's name, at the text's size, with a picture before it. */
function Fact({
  children,
  label,
  picture,
}: {
  children: ReactNode;
  label: string;
  picture: ReactNode;
}) {
  return (
    <span className="text-muted-foreground group-hover:text-accent-foreground flex min-w-0 items-center gap-1.5 text-sm">
      {picture}
      <span className="sr-only">{label}</span>
      <span className="truncate tabular-nums">{children}</span>
    </span>
  );
}

/** How a try-out stands, in one fact: the time left while it runs, its answered or right questions once over. */
function TryoutFact({ attempt }: { attempt: Attempt }) {
  const t = useTranslations("Home");
  const tTryouts = useTranslations("Tryouts");
  const format = useFormatter();
  const out = (count: number) =>
    `${format.number(count)}/${format.number(attempt.questions)}`;
  if (attempt.status === "in-progress") {
    return (
      <Fact
        label={tTryouts("remaining-time-label")}
        picture={<TimeRing attempt={attempt} />}
      >
        <TryoutClock expiresAt={attempt.expiresAt} />
      </Fact>
    );
  }
  if (attempt.status === "expired") {
    return (
      <Fact
        label={t("tryout-answered-label")}
        picture={<HugeIcons icon={HourglassIcon} />}
      >
        {out(attempt.answered)}
      </Fact>
    );
  }
  return (
    <Fact
      label={tTryouts("correct-answers-label")}
      picture={<HugeIcons icon={CheckmarkCircle02Icon} />}
    >
      {out(attempt.correct)}
    </Fact>
  );
}

/**
 * The end of a row: what the learner does next, a pill that keeps its icon and gives its word's room to the
 * name on a narrow card, or the score once a set is over. The row is the link; the pill only shows where it
 * leads.
 */
function TryoutEnd({ attempt }: { attempt: Attempt }) {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  if (attempt.status === "completed") {
    return attempt.score === null ? null : (
      <span className="shrink-0 self-center font-semibold tabular-nums">
        {format.number(attempt.score)}
      </span>
    );
  }
  const running = attempt.status === "in-progress";
  return (
    <Pill
      icon={running ? PlayIcon : RepeatIcon}
      label={running ? tCommon("continue") : t("tryout-again")}
    />
  );
}

/** The look of a button at a row's end, which a narrow card shows as its icon alone. */
function Pill({ icon, label }: { icon: IconSvgElement; label: string }) {
  return (
    <span
      className={cn(
        buttonVariants({ size: "sm", variant: "outline" }),
        "shrink-0 self-center rounded-full @max-xs/row:size-8 @max-xs/row:px-0"
      )}
    >
      <HugeIcons icon={icon} />
      <span className="@max-xs/row:sr-only">{label}</span>
    </span>
  );
}

/** A try-out's name: the part it runs on, else its track and set, one line. */
function TryoutName({ attempt }: { attempt: Attempt }) {
  const t = useTranslations("Home");
  const name =
    attempt.part?.title ??
    t("tryout-set", { set: attempt.title, track: attempt.track });
  return (
    <h3 className="truncate" title={name}>
      {name}
    </h3>
  );
}

/** One try-out: its tile, its name over how it stands, and what comes next. The row opens its attempt. */
function TryoutRow({ attempt }: { attempt: Attempt }) {
  return (
    <TryoutPageLink
      attemptId={attempt.attemptId}
      className={cn(rowLinkVariants(), "@container/row items-center")}
      publicPath={attempt.publicPath}
    >
      <TryoutTile attempt={attempt} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TryoutName attempt={attempt} />
        <TryoutFact attempt={attempt} />
      </div>
      <TryoutEnd attempt={attempt} />
    </TryoutPageLink>
  );
}

/**
 * Every other try-out, folded under the one the section shows: their tiles stacked and a count, opening
 * into their rows. A tile of a set that ran out of time is grey here too.
 */
function TryoutOthers({ attempts }: { attempts: readonly Attempt[] }) {
  const t = useTranslations("Home");
  const format = useFormatter();
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/others hover:bg-accent text-muted-foreground flex h-12 w-full items-center gap-2 px-4 transition-colors ease-out">
        <span className="flex gap-1.5">
          {Arr.map(Arr.take(attempts, STACKED), (attempt) => (
            <Tile
              className={cn(
                "size-6 rounded-sm",
                attempt.status === "expired" && "grayscale"
              )}
              key={attempt.attemptId}
              seed={attempt.part?.key ?? attempt.publicPath}
            >
              <HugeIcons icon={iconOf(attempt)} size="2xs" />
            </Tile>
          ))}
        </span>
        <span className="text-sm tabular-nums">
          <span aria-hidden>+{format.number(attempts.length)}</span>
          <span className="sr-only">
            {t("tryout-others", { count: attempts.length })}
          </span>
        </span>
        <HugeIcons
          className="ms-auto transition-transform duration-200 ease-out group-data-open/others:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col divide-y border-t">
          {Arr.map(attempts, (attempt) => (
            <TryoutRow attempt={attempt} key={attempt.attemptId} />
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/** What the row of a learner with no try-out shows: Nina, where to begin, and Start. */
function TryoutBeginBody({ start }: { start: TryoutStart }) {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  return (
    <>
      <Nina act="stretching" label="" size={44} whole />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="truncate">
          {start.kind === "country"
            ? start.country.title
            : t("tryout-pick-country")}
        </h3>
        <span className="text-muted-foreground group-hover:text-accent-foreground flex min-w-0 items-center gap-1.5 text-sm">
          {start.kind === "country" ? (
            <>
              <span className="flex shrink-0 gap-1">
                {Arr.map(start.exams, (exam) => (
                  <Tile
                    className="size-5 rounded-sm"
                    key={exam.examKey}
                    seed={exam.examKey}
                  >
                    <HugeIcons
                      icon={
                        TRYOUT_EXAM_ICONS[exam.examKey] ??
                        TRYOUT_EXAM_ICONS.snbt
                      }
                      size="2xs"
                    />
                  </Tile>
                ))}
              </span>
              <span className="truncate">
                {Arr.join(
                  Arr.map(start.exams, (exam) => exam.title),
                  ", "
                )}
              </span>
            </>
          ) : (
            <span className="flex gap-1">
              {Arr.map(start.countries, (place) => (
                <span
                  className="ring-foreground/10 flex size-5 overflow-hidden rounded-sm ring-1"
                  key={place.countryCode}
                  title={place.title}
                >
                  <CountryFlagIcon
                    className="h-5 w-7.5 max-w-none shrink-0 -translate-x-1.25"
                    countryCode={place.countryCode}
                  />
                </span>
              ))}
            </span>
          )}
        </span>
      </div>
      <Pill icon={Rocket01Icon} label={tCommon("start")} />
    </>
  );
}

/**
 * The row of a learner with no try-out yet. Nina warms up for the start, an act no other place shows. With
 * a country picked on the try-out page, the row names it and shows its exams and opens its page; with none,
 * it shows the flag of every country that holds try-outs and opens the try-outs to pick one.
 */
function TryoutBegin({ start }: { start: TryoutStart }) {
  const className = cn(rowLinkVariants(), "@container/row items-center");
  if (start.kind === "country") {
    return (
      <TryoutPageLink
        className={className}
        publicPath={start.country.publicPath}
      >
        <TryoutBeginBody start={start} />
      </TryoutPageLink>
    );
  }
  return (
    <TargetLink
      className={className}
      target={getPrimaryNavigationTarget(TRYOUT)}
    >
      <TryoutBeginBody start={start} />
    </TargetLink>
  );
}

/** The section's card, with See all once there is anything to see. */
function TryoutFrame({
  children,
  more,
}: {
  children: ReactNode;
  more: boolean;
}) {
  const tCommon = useTranslations("Common");
  return (
    <HomeSection
      action={more ? <SectionMore item={TRYOUT} /> : undefined}
      title={tCommon("try-out")}
    >
      {children}
    </HomeSection>
  );
}

/**
 * The home's second section (the owner's home notes, 14 Nov; the card of 22 Nov): one try-out at a time,
 * the one that wants the learner most. A set that runs comes first, the one whose time ends soonest, with
 * its part, its clock and Continue; else the set sat last, with its answered or right questions. Every
 * other try-out folds under it. A learner who has sat none is offered where to begin. Its clocks tick on the
 * page's `ClockProvider`.
 */
export function HomeTryouts({
  attempts,
  start,
}: {
  attempts: readonly Attempt[];
  start: TryoutStart | null;
}) {
  const [first, ...rest] = attempts;
  if (first === undefined) {
    return (
      <TryoutFrame more={false}>
        {start === null ? null : <TryoutBegin start={start} />}
      </TryoutFrame>
    );
  }
  return (
    <TryoutFrame more>
      <TryoutRow attempt={first} />
      {rest.length === 0 ? null : <TryoutOthers attempts={rest} />}
    </TryoutFrame>
  );
}
