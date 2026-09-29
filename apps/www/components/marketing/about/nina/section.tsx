import type { CapabilityOutput } from "@repo/backend/confect/nina/capability/progress";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { getLocale, getTranslations } from "next-intl/server";
import { AiChatMessageContent } from "@/components/ai/message/content";
import { MessageProvider } from "@/components/ai/message/context";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { NinaComposer } from "@/components/marketing/about/nina/client";
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

/** The fixed example uses the same presentation contract as a live Nina message. */
export async function FeaturesNina() {
  const locale = getLocaleOrThrow(await getLocale());
  const t = await getTranslations({ locale, namespace: "Features" });
  const answer: string = t.raw("nina-answer");
  const message: NinaMessage = {
    id: "features-nina-answer",
    key: "features-nina-answer",
    order: 0,
    stepOrder: 0,
    status: "success",
    role: "assistant",
    text: answer,
    _creationTime: 0,
    parts: [
      { type: "reasoning", text: t.raw("nina-reasoning"), state: "done" },
      {
        type: "tool-math",
        toolCallId: "features-nina-math",
        state: "output-available",
        input: { task: featuresNinaMathInput.expression },
        output: {
          artifacts: [
            { id: "calculation", type: "data-math", data: featuresNinaMath },
          ],
          text: "19",
        } satisfies CapabilityOutput,
      },
      { type: "text", text: answer, state: "done" },
    ],
  };

  return (
    <div
      className="flex min-h-152 min-w-0 flex-col border-b bg-background lg:col-span-5 lg:min-h-176 lg:border-r lg:border-b-0"
      data-slot="nina-showcase"
    >
      <h3 className="text-balance p-8 text-3xl tracking-tight sm:text-4xl lg:p-10">
        {t.rich("nina-title", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      </h3>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
        <Message align="end">
          <NinaPrompt id="features-nina-question" text={t.raw("nina-prompt")} />
        </Message>
        <Message>
          <MessageContent>
            <MessageProvider message={message}>
              <AiChatMessageContent />
            </MessageProvider>
          </MessageContent>
        </Message>
      </div>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 px-4 pb-4">
        <NinaComposer />
      </div>
    </div>
  );
}
