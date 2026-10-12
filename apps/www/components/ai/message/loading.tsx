"use client";

import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";

import { useMessage } from "@/components/ai/message/context";
import { isAnswerWaiting } from "@/components/ai/message/waiting";

/** Shows Nina typing in an answer that has begun but has nothing to show yet. */
export function AiChatMessageLoading() {
  const waiting = useMessage(({ last, message, turn }) =>
    isAnswerWaiting({ last, message, status: turn?.state.status })
  );

  if (!waiting) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <TypingLoader />
    </div>
  );
}
AiChatMessageLoading.displayName = "AiChatMessageLoading";
