import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ChatComposer } from "@/components/ai/chat/composer";
import { LearnerChatProvider } from "@/components/ai/chat/learner";
import { NinaTranscript } from "@/components/ai/transcript";

/**
 * Renders one chat's messages and its input inside Nina's sheet. The provider
 * gives each chat its own state, so choosing another chat in the history
 * shows none of the previous chat's error or pending prompt.
 */
export function SheetConversation({ chatId }: { chatId: Id<"chats"> }) {
  return (
    <LearnerChatProvider chatId={chatId}>
      <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
        <NinaTranscript />

        <ChatComposer autoFocus className="px-2 pb-2" />
      </div>
    </LearnerChatProvider>
  );
}
