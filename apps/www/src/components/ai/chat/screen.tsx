import { useDocumentTitle } from "@mantine/hooks";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { readChatArgs } from "@/components/ai/chat/access";
import { ChatBoundary } from "@/components/ai/chat/boundary";
import { useChat } from "@/components/ai/chat/context";
import { LearnerChatProvider } from "@/components/ai/chat/learner";
import { AiChat } from "@/components/ai/chat/view";
import { useViewer } from "@/lib/identity/client";
import { ownChatsTarget } from "@/lib/profile/href";

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
      <LearnerChatProvider chatId={chatId} key={chatId} shareToken={shareToken}>
        <AiChatMain />
      </LearnerChatProvider>
    </ChatBoundary>
  );
}

function AiChatMain() {
  const chat = useChat((s) => s.chat);

  useDocumentTitle(chat?.title ?? "");

  return (
    <>
      <LeaveDeletedChat />
      <AiChat />
    </>
  );
}

/**
 * Leaves the learner's chat for their chats once it was deleted in another tab
 * or on another device, says so, and keeps the chat out of the back history.
 * The page shows the chat as it was until the list is there, never the card of a
 * chat the viewer may not read.
 */
function LeaveDeletedChat() {
  const deleted = useChat((s) => s.deleted);
  const username = useViewer((s) => s.account?.appUser.username);
  const navigate = useNavigate();

  useEffect(() => {
    if (!deleted) {
      return;
    }
    toast.info({ title: "chat-deleted.title" });
    navigate({ ...ownChatsTarget(username), replace: true });
  }, [deleted, navigate, username]);

  return null;
}
