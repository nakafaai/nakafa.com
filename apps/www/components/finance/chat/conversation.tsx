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
import { AiChatModel } from "@/components/ai/chat-model";
import { FinanceChatLoading } from "@/components/finance/chat/loading";
import { FinanceChatMessage } from "@/components/finance/chat/message";
import { useFinanceCurrentChat } from "@/components/finance/chat/provider";
import { useAi } from "@/lib/context/use-ai";
import { useChat } from "@/lib/context/use-chat";

export function FinanceChatConversation() {
  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <FinanceChatConversationContent />

      <FinanceChatToolbar />
    </div>
  );
}

const FinanceChatConversationContent = memo(() => {
  const chat = useFinanceCurrentChat((s) => s.chat);

  const currentUser = useQuery(api.auth.getCurrentUser);
  const showActions = chat?.userId === currentUser?.appUser._id;

  const messages = useChat((state) => state.chat.messages);

  return (
    <Conversation>
      <ConversationContent className="mx-auto max-w-3xl">
        {messages.map((message) => (
          <Message
            from={message.role === "user" ? "user" : "assistant"}
            key={message.id}
          >
            <FinanceChatMessage message={message} showActions={showActions} />
          </Message>
        ))}

        <FinanceChatLoading />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
});
FinanceChatConversation.displayName = "FinanceChatConversation";

const FinanceChatToolbar = memo(() => {
  const t = useTranslations("Ai");

  const router = useRouter();

  const chat = useFinanceCurrentChat((s) => s.chat);

  const currentUser = useQuery(api.auth.getCurrentUser);
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const user = useQuery(api.auth.getCurrentUser);

  const { sendMessage, status } = useChat((state) => state.chat);

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text?.trim()) {
      return;
    }

    if (!user) {
      router.push(`/auth?redirect=/chat/${chat?._id}`);
      return;
    }

    sendMessage({
      text: message.text,
      files: message.files,
    });
    setText("");
  }

  // only show when user is the owner of the chat
  if (chat?.userId !== currentUser?.appUser._id) {
    return null;
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
FinanceChatToolbar.displayName = "FinanceChatToolbar";
