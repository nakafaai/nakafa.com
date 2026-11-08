import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
} from "@/components/marketing/about/tryout/demo";
import { SchoolFeatureText } from "@/components/marketing/school/row";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

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

/** A document of one paragraph that holds `text`, as an option's label is written. */
function paragraph(text: string) {
  return {
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  } as const;
}

/**
 * The exams row: one question of an exam in the exam player, its timer and its
 * place in the exam above it, and the player's real choices, which answer
 * themselves once the row is on screen while Nina thinks, then cheers the
 * scored answer.
 */
export function SchoolExams() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();
  const interaction: Interaction = {
    id: INTERACTION_ID,
    kind: "choice",
    label: t("demo-exam-answer"),
    maxChoices: 1,
    minChoices: 1,
    options: Arr.zipWith(OPTION_IDS, OPTION_MOMENTA, (id, momentum) => ({
      id,
      label: paragraph(`${format.number(momentum)} kg·m/s`),
    })),
    shuffle: false,
  };

  return (
    <TryoutDemo>
      <FeatureRow id="exams">
        <SchoolFeatureText feature="exams">
          <TryoutDemoNina />
        </SchoolFeatureText>
        <FeatureCard>
          <div className="flex items-center justify-between gap-4 border-b pb-4">
            <p className="min-w-0 truncate font-medium">
              {t("demo-exam-title")}
            </p>
            <time className="font-mono text-sm tabular-nums">24:13</time>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("demo-exam-progress", { current: 3, total: 20 })}
          </p>
          <p className="text-pretty">{t("demo-exam-question")}</p>
          <TryoutDemoQuestion
            answer={DEMO_KEY}
            id="school-exam-response"
            interaction={interaction}
          />
        </FeatureCard>
      </FeatureRow>
    </TryoutDemo>
  );
}
