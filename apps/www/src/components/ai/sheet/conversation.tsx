import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useEffect } from "react";
import { ChatComposer } from "@/components/ai/chat/composer";
import { useChat } from "@/components/ai/chat/context";
import { LearnerChatProvider } from "@/components/ai/chat/learner";
import { useAi } from "@/components/ai/context";
import { NinaTranscript } from "@/components/ai/transcript";

/**
 * Renders one chat's messages and its input inside Nina's sheet. The provider
 * gives each chat its own state, so choosing another chat in the history
 * shows none of the previous chat's error or pending prompt.
 */
export function SheetConversation({ chatId }: { chatId: Id<"chats"> }) {
  return (
    <LearnerChatProvider chatId={chatId}>
      <ForgetDeletedChat />
      <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
        <NinaTranscript />

        <ChatComposer autoFocus className="px-2 pb-2" />
      </div>
    </LearnerChatProvider>
  );
}

/**
 * Lets go of the chat the sheet shows once it was deleted in another tab or on
 * another device, and says so. The sheet then shows a new chat, never the card
 * of a chat the viewer may not read.
 */
function ForgetDeletedChat() {
  const deleted = useChat((s) => s.deleted);
  const chatId = useChat((s) => s.chatId);
  const forgetChat = useAi((state) => state.forgetChat);

  useEffect(() => {
    if (!deleted) {
      return;
    }
    toast.info({ title: "chat-deleted.title" });
    forgetChat(chatId);
  }, [chatId, deleted, forgetChat]);

  return null;
}
