import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
} from "@/components/marketing/about/tryout/demo";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { QuestionPaper } from "@/components/tenant/exams/sheet";

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

/** A document of one paragraph that holds one formula, as an option's label is written. */
function formula(latex: string) {
  return {
    content: [
      { content: [{ attrs: { latex }, type: "mathInline" }], type: "paragraph" },
    ],
    type: "doc",
  } as const;
}

/**
 * A number as a formula writes it: a decimal comma stands in braces, so the formula keeps it tight
 * instead of spacing it as a list.
 */
function latexNumber(text: string) {
  return text.replaceAll(",", "{,}");
}

/**
 * The exams part, as wide as the page: one question of an exam on the School exam editor's canvas, in
 * the paper the editor and the player share, the exam's title and the question's place above it as
 * the editor names a page. Its choices are the player's, with every answer written as a formula, and
 * they answer themselves once the paper is on screen while Nina thinks, then cheers the scored answer.
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
      label: formula(
        `${latexNumber(format.number(momentum))}\\ \\text{kg}\\cdot\\text{m/s}`
      ),
    })),
    shuffle: false,
  };

  return (
    <TryoutDemo>
      <FeatureRow id="exams" layout="wide">
        <SchoolFeatureText feature="exams">
          <TryoutDemoNina />
        </SchoolFeatureText>
        <FeatureProduct>
          <div className="bg-muted/40 rounded-xl border px-1 py-6 md:px-6">
            <div className="mx-auto grid w-full max-w-212 gap-2">
              <div className="flex min-h-9 items-center justify-between gap-2 px-2">
                <h3 className="min-w-0 truncate text-sm font-medium">
                  {t("demo-exam-title")}
                </h3>
                <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
                  {t("demo-exam-progress", { current: 3, total: 20 })}
                </p>
              </div>
              <QuestionPaper
                prompt={
                  <p className="text-pretty">
                    {t.rich("demo-exam-question", {
                      mass: () => <InlineMath math={"2\\ \\text{kg}"} />,
                      speed: () => <InlineMath math={"3\\ \\text{m/s}"} />,
                    })}
                  </p>
                }
                selected
              >
                <TryoutDemoQuestion
                  answer={DEMO_KEY}
                  id="school-exam-response"
                  interaction={interaction}
                />
              </QuestionPaper>
            </div>
          </div>
        </FeatureProduct>
      </FeatureRow>
    </TryoutDemo>
  );
}
