import type { DataPart } from "@repo/ai/schema/data";
import {
  Conversation,
  ConversationContent,
} from "@repo/design-system/components/ai/conversation";
import { MarkdownResponse } from "@repo/design-system/components/ai/markdown";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ai/message";
import { getLocale, getTranslations } from "next-intl/server";

import { MathEvidence } from "@/components/ai/message-part/math/evidence";
import {
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

      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-8 pt-8 pb-14 lg:px-10 lg:pt-12">
          <Message from="user">
            <MessageContent>
              <MarkdownResponse id="features-nina-question">
                {t.raw("nina-prompt")}
              </MarkdownResponse>
            </MessageContent>
          </Message>
          <Message from="assistant">
            <div className="flex size-full flex-col gap-6">
              <NinaReasoning label={aiT("thought-for-a-few-seconds")}>
                <MarkdownResponse id="features-nina-reasoning">
                  {t.raw("nina-reasoning")}
                </MarkdownResponse>
              </NinaReasoning>
              <NinaMath label={aiT("math-evaluate")}>
                <MathEvidence message={featuresNinaMath} />
              </NinaMath>
              <MessageContent>
                <MarkdownResponse id="features-nina-answer">
                  {t.raw("nina-answer")}
                </MarkdownResponse>
              </MessageContent>
            </div>
          </Message>
        </ConversationContent>
      </Conversation>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 px-8 pb-8 lg:px-10 lg:pb-10">
        <NinaPrompt placeholder={aiT("text-placeholder")} />
      </div>
    </div>
  );
}
