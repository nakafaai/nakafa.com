"use client";

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

import { AiChatModel } from "@/components/ai/chat-model";
import { useAi } from "@/components/ai/context/use-ai";

/** Shows one real Nina exchange with the same message renderer used in chat. */
export function FeaturesNina() {
  const t = useTranslations("Features");
  const aiT = useTranslations("Ai");
  const router = useRouter();
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);
  const ninaAnswer = t.raw("nina-answer");
  const ninaPrompt = t.raw("nina-prompt");

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
            <MessageContent>
              <Response id="features-nina-answer">{ninaAnswer}</Response>
            </MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>

      <div className="mx-auto grid w-full max-w-3xl shrink-0 px-8 pb-8 lg:px-10 lg:pb-10">
        <PromptInput onSubmit={handleSubmit}>
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
