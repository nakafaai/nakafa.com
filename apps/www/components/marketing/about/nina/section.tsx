import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import { MessageContent } from "@repo/design-system/components/ui/message";
import { getLocale, getTranslations } from "next-intl/server";

import { MathEvidence } from "@/components/ai/message/evidence/math/result";
import {
  NinaExample,
  NinaMath,
  NinaPrompt,
  NinaReasoning,
} from "@/components/marketing/about/nina/client";
import { getLocaleOrThrow } from "@/lib/i18n/params";

const featuresNinaMathInput: DataPart["math"]["input"] = {
  expression: "5 * 2 + 9 / 1",
  kind: "math",
  operation: "evaluate",
};

const featuresNinaMath: DataPart["math"] = {
  input: featuresNinaMathInput,
  kind: "evaluate",
  result: {
    conditions: [],
    input: featuresNinaMathInput,
    items: [],
    kind: "evaluate",
    operation: "evaluate",
    primary: {
      expression: "5 * 2 + 9 / 1",
      latex: "5(2) + \\frac{9}{1}",
    },
    reason: "verified",
    secondary: {
      expression: "19",
      latex: "19",
    },
    stepStatus: "complete",
    steps: [
      {
        action: "evaluate",
        items: [],
        primary: {
          expression: "5 * 2 + 9 / 1",
          latex: "5(2) + \\frac{9}{1}",
        },
        relation: {
          expression: "equals",
          latex: "=",
        },
        secondary: {
          expression: "19",
          latex: "19",
        },
      },
    ],
    status: "verified",
  },
  status: "verified",
  summary: "verified",
};

/** Renders Nina's fixed example transcript on the server. */
export async function FeaturesNina() {
  const locale = getLocaleOrThrow(await getLocale());
  const [t, aiT] = await Promise.all([
    getTranslations({ locale, namespace: "Features" }),
    getTranslations({ locale, namespace: "Ai" }),
  ]);

  return (
    <div className="flex min-h-[38rem] flex-col border-b bg-background lg:col-span-5 lg:min-h-[44rem] lg:border-r lg:border-b-0">
      <h3 className="text-balance p-8 text-3xl tracking-tight sm:text-4xl lg:p-10">
        {t.rich("nina-title", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      </h3>

      <NinaExample
        question={
          <MarkdownContent id="features-nina-question">
            {t.raw("nina-prompt")}
          </MarkdownContent>
        }
      >
        <NinaReasoning label={aiT("thought-for-a-few-seconds")}>
          <MarkdownContent id="features-nina-reasoning">
            {t.raw("nina-reasoning")}
          </MarkdownContent>
        </NinaReasoning>
        <NinaMath label={aiT("math-evaluate")}>
          <MathEvidence message={featuresNinaMath} />
        </NinaMath>
        <MessageContent>
          <MarkdownContent id="features-nina-answer">
            {t.raw("nina-answer")}
          </MarkdownContent>
        </MessageContent>
      </NinaExample>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 px-8 pb-8 lg:px-10 lg:pb-10">
        <NinaPrompt placeholder={aiT("text-placeholder")} />
      </div>
    </div>
  );
}
