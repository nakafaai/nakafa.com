import type { TryoutQuestionBody as Question } from "@repo/backend/confect/tryouts/runtime/spec";
import { Card } from "@repo/design-system/components/ui/card";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
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
import {
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import { TryoutQuestionBody } from "@/components/tryout/runtime/question/body";

/** The same practice question in every release, with the answer Nina explains in the next section. */
export function Tryout() {
  const t = useTranslations("Landing");
  const common = useTranslations("Common");
  const question = {
    interaction: {
      id: "choice",
      kind: "choice",
      label: common("answer"),
      maxChoices: 1,
      minChoices: 1,
      options: Arr.map([10, 13, 19, 15, 18], (answer) => ({
        id: `option-${answer}`,
        label: {
          content: [
            {
              content: [
                { attrs: { latex: String(answer) }, type: "mathInline" },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
      })),
      shuffle: false,
    },
    key: { correct: ["option-19"], interaction: "choice", kind: "choice" },
    prompt: {
      content: [
        {
          content: [{ text: t("tryout-demo-intro"), type: "text" }],
          type: "paragraph",
        },
        {
          attrs: { latex: "\\triangle(a,b)=2a+\\frac{b}{m}" },
          type: "mathBlock",
        },
        {
          content: [
            { text: t("tryout-demo-given"), type: "text" },
            { attrs: { latex: "\\triangle(2,4)=8" }, type: "mathInline" },
            { text: t("tryout-demo-find"), type: "text" },
            { attrs: { latex: "\\triangle(5,9)" }, type: "mathInline" },
            { text: "?", type: "text" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    },
  } satisfies Question;

  return (
    <TryoutDemo>
      <FeatureRow id="tryout">
        <FeatureText>
          <TryoutDemoNina act="thinking" />
          <FeatureTitle>{t("tryout-title")}</FeatureTitle>
          <FeatureLead>{t("tryout-lead")}</FeatureLead>
        </FeatureText>
        <FeatureProduct>
          <Card className="min-w-0 gap-0 px-(--card-spacing)">
            <PlayerQuestionHeader number={1} />
            <PlayerQuestionPrompt>
              <TryoutQuestionBody body={question} />
            </PlayerQuestionPrompt>
            <PlayerQuestionAnswer>
              <TryoutDemoQuestion
                answer={question.key}
                id="home-tryout-response"
                interaction={question.interaction}
              />
            </PlayerQuestionAnswer>
          </Card>
        </FeatureProduct>
      </FeatureRow>
    </TryoutDemo>
  );
}
