import {
  RankingIcon,
  Rocket01Icon,
  Target02Icon,
  TaskDone01Icon,
  Timer01Icon,
  TimerOffIcon,
} from "@hugeicons/core-free-icons";
import type { TryoutStartAccess } from "@repo/backend/confect/tryouts/start/spec";
import { TRYOUT_ATTEMPT_WINDOW } from "@repo/backend/confect/tryouts/window";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { TileLook } from "@repo/design-system/lib/look";
import { getTileLooks } from "@repo/design-system/lib/look";
import { cva } from "class-variance-authority";
import { Array as Arr, Duration, Option, Schema, Tuple } from "effect";
import { useId, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { PaneFact, PaneFacts } from "@/components/shared/page/pane";
import { useOptionalSetPane } from "@/components/tryout/pane/context";
import { getTryoutPracticeTarget } from "@/components/tryout/route/path";
import type { TryoutPart } from "@/components/tryout/set/model";
import { TargetLink } from "@/lib/routing/link";

/** How a learner takes the set: a practice with no clock, or the timed simulation of the real exam. */
const StartMode = Schema.Literals(["practice", "simulation"]);
type StartMode = typeof StartMode.Type;

/** Each way to take the set: its tile's icon, its name, and its two facts, each an icon and a few words. */
const MODES = [
  {
    facts: [
      [TimerOffIcon, "practice-no-timer"],
      [TaskDone01Icon, "practice-check-each"],
    ],
    icon: Target02Icon,
    mode: "practice",
    title: "practice-cta",
  },
  {
    facts: [
      [Timer01Icon, "start-timer"],
      [RankingIcon, "start-history"],
    ],
    icon: Rocket01Icon,
    mode: "simulation",
    title: "simulation-cta",
  },
] as const;

interface TryoutStartDialogProps {
  /** Single-section direct-entry part facts, shown before its non-pausable timer starts. */
  readonly entryPart?: TryoutPart | undefined;
  readonly finishedAttempt: boolean;
  readonly kind: TryoutStartAccess["kind"];
  readonly onPrimary: () => void;
  readonly open: boolean;
  /** The page the start was pressed on, whose practice the dialog's practice opens. */
  readonly pagePath: string;
  readonly setOpen: (open: boolean) => void;
}

/**
 * Asks how the learner takes the set before it starts, as two cards side by side, each the mode's tile, its name
 * and what it means in two short facts: the practice, with no clock and a check on every question, or the timed
 * simulation, whose score goes on the set's board. For a single-section set, simulation also shows exact question
 * count and duration before the non-pausable clock starts.
 */
export function TryoutStartDialog(props: TryoutStartDialogProps) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const setPane = useOptionalSetPane();
  const [mode, setMode] = useState<StartMode>("simulation");
  const copy = getDialogCopy(props, t);
  const practice = getTryoutPracticeTarget(props.pagePath);
  const practicing = Option.filter(practice, () => mode === "practice");
  const hasPracticeTab = props.entryPart === undefined && setPane !== null;
  const selectable = Option.isSome(practice) || hasPracticeTab;
  const shown = selectable
    ? MODES
    : Arr.filter(MODES, (each) => each.mode === "simulation");
  const looks = getTileLooks(
    Arr.map(shown, (each) => Tuple.make([each.icon], each.mode))
  );
  const cards = Arr.map(Arr.zip(shown, looks), ([each, look]) => (
    <StartModeCard
      key={each.mode}
      look={look}
      mode={each}
      selectable={selectable}
    />
  ));
  const showEntryFacts = props.entryPart !== undefined && mode === "simulation";
  const switchesToPracticeTab = mode === "practice" && hasPracticeTab;

  return (
    <ResponsiveDialog
      action={
        switchesToPracticeTab ? (
          <Button
            onClick={() => {
              props.setOpen(false);
              setPane.setMode("practice");
            }}
            type="button"
          >
            <HugeIcons data-icon="inline-start" icon={Target02Icon} />
            {t("practice-start-cta")}
          </Button>
        ) : (
          Option.match(practicing, {
            onNone: () => (
              <Button onClick={props.onPrimary} type="button">
                <HugeIcons data-icon="inline-start" icon={Rocket01Icon} />
                {copy.primary}
              </Button>
            ),
            onSome: (target) => (
              <TargetLink
                className={buttonVariants()}
                onClick={() => props.setOpen(false)}
                target={target}
              >
                <HugeIcons data-icon="inline-start" icon={Target02Icon} />
                {t("practice-start-cta")}
              </TargetLink>
            ),
          })
        )
      }
      description={
        showEntryFacts ? t("start-part-description") : copy.description
      }
      open={props.open}
      setOpen={props.setOpen}
      title={copy.title}
    >
      <div className="flex flex-col gap-3">
        {selectable ? (
          <RadioGroup
            aria-label={t("start-mode-label")}
            className="grid gap-3"
            onValueChange={(next) => {
              if (Schema.is(StartMode)(next)) {
                setMode(next);
              }
            }}
            value={mode}
          >
            {cards}
          </RadioGroup>
        ) : (
          cards
        )}
        {showEntryFacts && props.entryPart !== undefined ? (
          <PaneFacts layout="grid">
            <PaneFact label={tCommon("exam-questions")}>
              {format.number(props.entryPart.questionCount)}
            </PaneFact>
            <PaneFact label={t("set-column-duration")}>
              {t("set-duration-minutes", {
                minutes: props.entryPart.timeLimitSeconds / 60,
              })}
            </PaneFact>
          </PaneFacts>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

/** A mode card's frame: the chosen card of two outlines itself in the primary color. */
const modeCardVariants = cva(
  "flex min-w-0 flex-col gap-4 rounded-lg border p-4 transition-colors ease-out",
  {
    variants: {
      selectable: {
        false: "",
        true: "has-data-checked:border-primary hover:bg-accent/50 cursor-pointer has-data-checked:bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))]",
      },
    },
  }
);

/**
 * One way to take the set: its tile and name over its facts, each an icon and a few words. A choice among two is a
 * card that holds its radio in its top end corner, named by the mode and described by its facts; the one way a
 * page offers is the same card without the radio.
 */
function StartModeCard({
  look,
  mode,
  selectable,
}: {
  look: TileLook;
  mode: (typeof MODES)[number];
  selectable: boolean;
}) {
  const t = useTranslations("Tryouts");
  const id = useId();
  const Card = selectable ? "label" : "div";
  return (
    <Card className={modeCardVariants({ selectable })}>
      <span className="flex items-center gap-3">
        <Tile className="size-9" seed={look.seed} shift={look.shift}>
          <TileIcon icon={look.icon} />
        </Tile>
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium"
          id={`${id}-title`}
        >
          {t(mode.title)}
        </span>
        {selectable ? (
          <Radio
            aria-describedby={`${id}-facts`}
            aria-labelledby={`${id}-title`}
            value={mode.mode}
          />
        ) : null}
      </span>
      <ul
        className="text-muted-foreground flex flex-col gap-2 text-sm"
        id={`${id}-facts`}
      >
        {Arr.map(mode.facts, ([icon, fact]) => (
          <li className="flex min-w-0 items-center gap-2" key={fact}>
            <HugeIcons className="shrink-0" icon={icon} />
            <span className="truncate">{t(fact)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The hours an attempt stays open, which the dialog's words name. */
const WINDOW_HOURS = { hours: Duration.toHours(TRYOUT_ATTEMPT_WINDOW) };

/** Selects localized dialog copy from the resolved access decision. */
function getDialogCopy(
  props: Pick<TryoutStartDialogProps, "finishedAttempt" | "kind">,
  t: ReturnType<typeof useTranslations<"Tryouts">>
) {
  if (props.kind === "free-attempt") {
    return {
      description: t("free-dialog-description"),
      primary: t("free-cta"),
      title: t("free-dialog-title"),
    };
  }
  if (props.finishedAttempt) {
    return {
      description: t("restart-dialog-description"),
      primary: t("action.restart-cta"),
      title: t("restart-dialog-title"),
    };
  }
  return {
    description: t("start-dialog-description", WINDOW_HOURS),
    primary: t("action.start-cta"),
    title: t("start-dialog-title"),
  };
}
