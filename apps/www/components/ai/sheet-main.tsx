"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import type { PromptInputMessage } from "@repo/design-system/components/ai/input";
import { Message } from "@repo/design-system/components/ai/message";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { memo } from "react";
import { AiChatError } from "@/components/ai/chat-error";
import { AiChatMessage } from "@/components/ai/chat-message";
import { AiChatPaginationTrigger } from "@/components/ai/chat-pagination-trigger";
import { AiChatPending } from "@/components/ai/chat-pending";
import { ChatSpacing } from "@/components/ai/chat-spacing";
import { useAi } from "@/components/ai/context/use-ai";
import { ChatProvider, useChat } from "@/components/ai/context/use-chat";
import { useCurrentChat } from "@/components/ai/context/use-current-chat";
import { SheetInput } from "@/components/ai/sheet-input";
import { useUser } from "@/lib/context/use-user";

/** Connects the selected chat document to the sheet chat UI. */
export const SheetMain = memo(() => {
  const chat = useCurrentChat((state) => state.chat);
  const messages = useCurrentChat((state) => state.messages);

  if (!(chat && messages)) {
    return <SheetMainPlaceholder />;
  }

  return (
    <ChatProvider
      chatId={chat._id}
      initialMessages={messages}
      pendingQueryOwner="sheet"
    >
      <SheetConversation />
    </ChatProvider>
  );
});

/** Keeps the sheet stable while the active chat loads. */
const SheetMainPlaceholder = memo(() => {
  /** Ignores submits while the active chat payload is loading. */
  function handleSubmit() {
    return;
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent>
          <div />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <SheetInput
        disabled={true}
        isPending={true}
        key="ai-sheet-input"
        onSubmit={handleSubmit}
      />
    </div>
  );
});

/** Renders messages and the active chat input inside Nina sheet. */
const SheetConversation = memo(() => {
  const router = useRouter();
  const pathname = usePathname();

  const messages = useChat((state) => state.chat.messages);
  const setText = useAi((state) => state.setText);

  const user = useUser((state) => state.user);
  const { sendMessage, status, stop } = useChat((state) => state.chat);

  /** Sends a message or stops the current stream from the sheet input. */
  function handleSubmit(message: PromptInputMessage) {
    if (status === "streaming") {
      stop();
      return;
    }

    if (!message.text?.trim()) {
      return;
    }

    if (!user) {
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    sendMessage({
      files: message.files,
      text: message.text,
    });
    setText("");
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent>
          {messages.map((message, index) => (
            <Message
              from={message.role === "user" ? "user" : "assistant"}
              key={message.id}
            >
              {index === 0 ? <AiChatPaginationTrigger /> : null}
              <AiChatMessage message={message} />
            </Message>
          ))}

          <AiChatPending />

          <AiChatError />

          <ChatSpacing />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <SheetInput
        disabled={status === "submitted"}
        key="ai-sheet-input"
        onSubmit={handleSubmit}
        status={status}
      />
    </div>
  );
});
