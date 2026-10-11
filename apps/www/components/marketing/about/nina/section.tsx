import type { CapabilityOutput } from "@repo/backend/confect/nina/capability/progress";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import type { ToolUIPart } from "ai";
import { getLocale, getTranslations } from "next-intl/server";
import { Activity } from "@/components/ai/message/activity";
import { getMathIcon } from "@/components/ai/message/evidence/math/icons";
import { MathEvidence } from "@/components/ai/message/evidence/math/result";
import { MathPart } from "@/components/ai/message/evidence/math/view";
import { readInvocation } from "@/components/ai/message/invocation";
import { NinaPrompt } from "@/components/ai/message/prompt";
import {
  MessageSection,
  MessageSections,
} from "@/components/ai/message/section";
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

const featuresNinaActivity = {
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
} satisfies ToolUIPart;

/**
 * The fixed example composes the live transcript's components on the server,
 * so the homepage ships their interactive shells without a Markdown renderer.
 */
export async function FeaturesNina() {
  const locale = getLocaleOrThrow(await getLocale());
  const t = await getTranslations({ locale, namespace: "Features" });
  const prompt: string = t.raw("nina-prompt");
  const reasoning: string = t.raw("nina-reasoning");
  const answer: string = t.raw("nina-answer");

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
          <NinaPrompt>
            <MarkdownContent id="features-nina-question" variant="chat">
              {prompt}
            </MarkdownContent>
          </NinaPrompt>
        </Message>
        <Message>
          <MessageContent>
            <MessageSections>
              <MessageSection kind="activity">
                <Reasoning className="w-full" defaultOpen={false}>
                  <ReasoningTrigger />
                  <ReasoningContent>
                    <MarkdownContent
                      id="features-nina-reasoning"
                      variant="note"
                    >
                      {reasoning}
                    </MarkdownContent>
                  </ReasoningContent>
                </Reasoning>
                <Activity
                  invocation={readInvocation(featuresNinaActivity, true)}
                >
                  <MathPart
                    icon={getMathIcon(featuresNinaMath.kind)}
                    message={featuresNinaMath}
                  >
                    <MathEvidence message={featuresNinaMath} />
                  </MathPart>
                </Activity>
              </MessageSection>
              <MessageSection kind="response">
                <MarkdownContent id="features-nina-answer" variant="chat">
                  {answer}
                </MarkdownContent>
              </MessageSection>
            </MessageSections>
          </MessageContent>
        </Message>
      </div>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 px-4 pb-4">
        <NinaComposer />
      </div>
    </div>
  );
}
