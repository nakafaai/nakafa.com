"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input";
import { Message } from "@repo/design-system/components/ai/message";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useAi } from "@/lib/context/use-ai";
import { useChat } from "@/lib/context/use-chat";
import { AiChatMessage } from "./chat-message";
import { AiChatModel } from "./chat-model";

export function AiChat() {
  const { messages, status, regenerate } = useChat((state) => state.chat);

  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh">
      <div className="relative flex size-full flex-col overflow-hidden">
        <Conversation>
          <ConversationContent className="mx-auto max-w-3xl">
            {messages.map((message) => (
              <Message
                from={message.role === "user" ? "user" : "assistant"}
                key={message.id}
              >
                <AiChatMessage
                  message={message}
                  regenerate={regenerate}
                  status={status}
                />
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <AIChatToolbar />
      </div>
    </main>
  );
}

const AIChatToolbar = memo(() => {
  const t = useTranslations("Ai");

  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const { sendMessage, status } = useChat((state) => state.chat);

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) {
      return;
    }

    sendMessage({
      text: message.text,
      files: message.files,
    });
    setText("");
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl shrink-0">
      <PromptInput
        className="rounded-b-none border-b-0"
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          autoFocus
          className="p-4"
          onChange={(e) => setText(e.target.value)}
          placeholder={t("text-placeholder")}
          value={text}
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <AiChatModel />
          </PromptInputTools>
          <PromptInputSubmit
            disabled={status === "submitted"}
            status={status}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
});
AIChatToolbar.displayName = "AIChatToolbar";
