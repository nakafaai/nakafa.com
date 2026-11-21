import type { TryoutQuestionBody as Question } from "@repo/backend/confect/tryouts/runtime/spec";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
} from "@/components/marketing/about/tryout/demo";
import {
  FeatureCard,
  FeatureLead,
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
    interactions: [
      {
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
    ],
    keys: [{ correct: ["option-19"], interaction: "choice", kind: "choice" }],
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
        <FeatureCard>
          <PlayerQuestionHeader number={1} />
          <PlayerQuestionPrompt className="my-0">
            <TryoutQuestionBody body={question} />
          </PlayerQuestionPrompt>
          <PlayerQuestionAnswer className="my-0">
            <TryoutDemoQuestion
              answer={question.keys[0]}
              id="home-tryout-response"
              interaction={question.interactions[0]}
            />
          </PlayerQuestionAnswer>
        </FeatureCard>
      </FeatureRow>
    </TryoutDemo>
  );
}
