import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
} from "@/components/marketing/about/tryout/demo";
import {
  FeatureLead,
  FeatureProduct,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";
import { PlayerFlag } from "@/components/player/flag";
import { PlayerNext, PlayerPrevious } from "@/components/player/footer";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { readPosition } from "@/components/player/order";
import { PlayerProvider, usePlayer } from "@/components/player/provider";
import { PlayerDigits } from "@/components/player/timer";

/** The id of the demo's interaction, which its key names. */
const INTERACTION_ID = "momentum";

/** The momentum of each option of the demo question, in kg·m/s. The third is the ball's: 2 kg at 3 m/s. */
const OPTION_MOMENTA = [1.5, 5, 6, 9] as const;

/** The option ids, in the order the question shows them. */
const OPTION_IDS = ["a", "b", "c", "d"] as const;

/** The key of the demo question: its third option. */
const DEMO_KEY: InteractionKey = {
  correct: ["c"],
  interaction: INTERACTION_ID,
  kind: "choice",
};

/** The twenty questions of the demo exam, in the frozen order the navigator numbers them by. */
const KEYS = Arr.makeBy(20, (index) => `q${index + 1}`);

/** The questions the student has answered so far, the first one among them once the demo answers it. */
const ANSWERED = ["q2", "q3", "q5", "q6", "q8", "q9", "q10", "q12"];

/** The time left on the exam's clock, in seconds: 24 minutes and 13 seconds. */
const TIME_LEFT = 1453;

/** A document of one paragraph that holds one formula, as an option's label is written. */
function formula(latex: string) {
  return {
    content: [
      {
        content: [{ attrs: { latex }, type: "mathInline" }],
        type: "paragraph",
      },
    ],
    type: "doc",
  } as const;
}

/** A number as a formula writes it: a decimal comma stands in braces, so the formula keeps it tight. */
function latexNumber(text: string) {
  return text.replaceAll(",", "{,}");
}

/** Where the student is in the exam, as the player's header says it, read from the player's own store. */
function PlayerPlace() {
  const t = useTranslations("SchoolSite");
  const number = usePlayer((state) => readPosition(state.keys, state.current));

  return (
    <p className="text-muted-foreground min-w-0 truncate text-end text-sm tabular-nums">
      {t("demo-exam-progress", { current: number, total: KEYS.length })}
    </p>
  );
}

/**
 * The exam as a student sits it, on one surface as the player draws it: the header with the exam,
 * the clock and the place, the question with its choices written as formulas, the navigator that
 * marks what is answered and flagged, and the footer that steps and flags. The navigator, the steps
 * and the flag are the player's own, so a press moves and flags here as it does in the exam.
 */
function PlayerWindow() {
  const t = useTranslations("SchoolSite");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const [flagged, setFlagged] = useState<readonly string[]>(["q7"]);
  const questions = Arr.map(KEYS, (key) => ({
    answered: Arr.contains(ANSWERED, key),
    flag: () =>
      setFlagged((current) =>
        Arr.contains(current, key)
          ? Arr.filter(current, (each) => each !== key)
          : Arr.append(current, key)
      ),
    flagged: Arr.contains(flagged, key),
    key,
    pick: () => false,
  }));
  const interaction: Interaction = {
    id: INTERACTION_ID,
    kind: "choice",
    label: tCommon("answer"),
    maxChoices: 1,
    minChoices: 1,
    options: Arr.zipWith(OPTION_IDS, OPTION_MOMENTA, (id, momentum) => ({
      id,
      label: formula(
        `${latexNumber(format.number(momentum))}\\ \\text{kg}\\cdot\\text{m/s}`
      ),
    })),
    shuffle: false,
  };

  return (
    <div className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
      <div className="bg-muted/50 grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4">
        <h3 className="min-w-0 truncate text-base font-medium">
          {t("demo-exam-title")}
        </h3>
        <PlayerDigits seconds={TIME_LEFT} />
        <PlayerPlace />
      </div>
      <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="grid min-w-0 content-start gap-6">
          <p className="text-pretty">
            {t.rich("demo-exam-question", {
              mass: () => <InlineMath math={"2\\ \\text{kg}"} />,
              speed: () => <InlineMath math={"3\\ \\text{m/s}"} />,
            })}
          </p>
          <TryoutDemoQuestion
            answer={DEMO_KEY}
            id="school-player-response"
            interaction={interaction}
          />
        </div>
        <PlayerGrid questions={questions} />
      </div>
      <div className="bg-muted/50 flex h-14 items-center justify-between gap-2 px-4">
        <PlayerPrevious />
        <div className="relative">
          <PlayerFlag locked={false} questions={questions} />
        </div>
        <PlayerNext />
      </div>
    </div>
  );
}

/**
 * The player part: the exam a teacher wrote, as every student sits it, in the School's own player.
 * Its choices answer themselves once they are on screen while Nina thinks, then she cheers the scored
 * answer; the navigator, the steps and the flag take the reader's presses.
 */
export function SchoolPlayer() {
  const t = useTranslations("SchoolSite");

  return (
    <TryoutDemo>
      <FeatureRow id="player">
        <FeatureText>
          <span className="inline-block" id="player-nina">
            <TryoutDemoNina />
          </span>
          <FeatureTitle>{t("player-title")}</FeatureTitle>
          <FeatureLead>{t("player-lead")}</FeatureLead>
        </FeatureText>
        <FeatureProduct>
          <PlayerProvider keys={KEYS} mode="single">
            <PlayerWindow />
          </PlayerProvider>
        </FeatureProduct>
      </FeatureRow>
    </TryoutDemo>
  );
}
