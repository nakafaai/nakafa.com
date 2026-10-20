import { Message } from "@repo/design-system/components/ui/message";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";

import { useChat } from "@/components/ai/chat/context";

/** Shows Nina typing while a turn runs and its reply has not started. */
export function AiChatPending({ replied }: { replied: boolean }) {
  const busy = useChat((state) => state.busy);

  if (!busy || replied) {
    return null;
  }

  return (
    <MessageScrollerItem messageId="pending">
      <Message>
        <TypingLoader />
      </Message>
    </MessageScrollerItem>
  );
}
AiChatPending.displayName = "AiChatPending";
