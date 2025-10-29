"use client";

import { api } from "@repo/backend/convex/_generated/api";
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
import { useRouter } from "@repo/internationalization/src/navigation";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useAi } from "@/lib/context/use-ai";
import { useChat } from "@/lib/context/use-chat";
import { AiChatHeader } from "./chat-header";
import { AIChatLoading } from "./chat-loading";
import { AiChatMessage } from "./chat-message";
import { AiChatModel } from "./chat-model";

export function AiChat() {
  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <AiChatHeader />

      <AiChatConversation />

      <AiChatToolbar />
    </div>
  );
}

const AiChatConversation = memo(() => {
  const messages = useChat((state) => state.chat.messages);

  return (
    <Conversation>
      <ConversationContent className="mx-auto max-w-3xl">
        {messages.map((message) => (
          <Message
            from={message.role === "user" ? "user" : "assistant"}
            key={message.id}
          >
            <AiChatMessage message={message} />
          </Message>
        ))}

        <AIChatLoading />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
});
AiChatConversation.displayName = "AiChatConversation";

const AiChatToolbar = memo(() => {
  const t = useTranslations("Ai");

  const router = useRouter();

  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const user = useQuery(api.auth.getCurrentUser);

  const { sendMessage, status } = useChat((state) => state.chat);

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text?.trim()) {
      return;
    }

    if (!user) {
      router.push("/auth?redirect=/chat");
      return;
    }

    sendMessage({
      text: message.text,
      files: message.files,
    });
    setText("");
  }

  return (
    <div className="mx-auto mb-2 grid w-full max-w-3xl shrink-0 px-2">
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
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
AiChatToolbar.displayName = "AIChatToolbar";
