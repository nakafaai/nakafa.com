"use client";

import { useDocumentTitle } from "@mantine/hooks";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { readChatArgs } from "@/components/ai/chat/access";
import { ChatBoundary } from "@/components/ai/chat/boundary";
import { ChatProvider, useChat } from "@/components/ai/chat/context";
import { AiChat } from "@/components/ai/chat/view";

/**
 * The page of one chat. A link can arrive after the address, as a change of its
 * fragment in the same page, so the boundary that shows a chat the viewer may
 * not read tries again when the token changes. The token is compared here and
 * goes nowhere else.
 */
export function AiChatPage({
  chatId,
  shareToken,
}: {
  chatId: Id<"chats">;
  shareToken?: string | undefined;
}) {
  return (
    <ChatBoundary
      read={{
        args: readChatArgs(chatId, shareToken),
        ref: nina.conversation.get,
      }}
      resetKeys={[shareToken]}
    >
      <ChatProvider chatId={chatId} shareToken={shareToken}>
        <AiChatMain />
      </ChatProvider>
    </ChatBoundary>
  );
}

function AiChatMain() {
  const chat = useChat((s) => s.chat);

  useDocumentTitle(chat?.title ?? "");

  return <AiChat />;
}
