"use client";

import type { DataPart } from "@repo/ai/schema/data";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  Conversation,
  ConversationContent,
} from "@repo/design-system/components/ai/conversation";
import { PromptInput } from "@repo/design-system/components/ai/input";
import {
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input-controls";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ai/message";
import { Response } from "@repo/design-system/components/ai/response";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import type { ClipboardEvent } from "react";

import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";
import { MessageProvider } from "@/components/ai/context/use-message";
import { AiMessagePart } from "@/components/ai/message-part";

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

/** Keeps the marketing prompt text-only without changing Nina's shared input. */
function stopAttachmentPaste(event: ClipboardEvent<HTMLFormElement>) {
  const includesFile = Array.from(event.clipboardData.items).some(
    (item) => item.kind === "file"
  );
  if (includesFile) {
    event.stopPropagation();
  }
}

/** Shows one real Nina exchange with the same message renderer used in chat. */
export function FeaturesNina() {
  const t = useTranslations("Features");
  const aiT = useTranslations("Ai");
  const router = useRouter();
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);
  const ninaAnswer = t.raw("nina-answer");
  const ninaPrompt = t.raw("nina-prompt");
  const ninaReasoning = t.raw("nina-reasoning");
  const ninaPartEntries = [
    {
      key: "features-nina-reasoning",
      part: {
        state: "done",
        text: ninaReasoning,
        type: "reasoning",
      },
    },
    {
      key: "features-nina-math",
      part: {
        data: featuresNinaMath,
        id: "features-nina-math",
        type: "data-math",
      },
    },
    {
      key: "features-nina-answer",
      part: {
        state: "done",
        text: ninaAnswer,
        type: "text",
      },
    },
  ] satisfies ReadonlyArray<{
    key: string;
    part: MyUIMessage["parts"][number];
  }>;
  const ninaMessage: MyUIMessage = {
    id: "features-nina-answer",
    parts: ninaPartEntries.map(({ part }) => part),
    role: "assistant",
  };

  /** Opens Nina with the learner's current marketing-page draft. */
  function handleSubmit(message: PromptInputMessage) {
    const query = message.text?.trim();
    if (!query) {
      return;
    }

    setText(query);
    router.push("/chat");
  }

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
              <Response id="features-nina-question">{ninaPrompt}</Response>
            </MessageContent>
          </Message>
          <Message from="assistant">
            <MessageProvider message={ninaMessage}>
              <div className="flex size-full flex-col gap-3 group-[.is-user]:items-end group-[.is-user]:justify-end">
                <div className="flex flex-col gap-6">
                  {ninaPartEntries.map(({ key, part }, partIndex) => (
                    <AiMessagePart
                      key={key}
                      part={part}
                      partIndex={partIndex}
                    />
                  ))}
                </div>
              </div>
            </MessageProvider>
          </Message>
        </ConversationContent>
      </Conversation>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 px-8 pb-8 lg:px-10 lg:pb-10">
        <PromptInput
          maxFiles={0}
          onPasteCapture={stopAttachmentPaste}
          onSubmit={handleSubmit}
        >
          <PromptInputTextarea
            aria-label={aiT("text-placeholder")}
            className="p-4"
            onChange={(event) => setText(event.target.value)}
            placeholder={aiT("text-placeholder")}
            value={text}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <AiChatModel />
            </PromptInputTools>
            <PromptInputSubmit />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}
