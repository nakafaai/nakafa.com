"use client";

import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { isToolUIPart } from "ai";
import { Array as Arr } from "effect";

import { useMessage } from "@/components/ai/message/context";

/** Shows Nina typing in an answer that has begun but has nothing to show yet. */
export function AiChatMessageLoading() {
  const message = useMessage((state) => state.message);
  const working = useMessage(
    (state) =>
      state.turn?.state.status === "queued" ||
      state.turn?.state.status === "running"
  );

  // Only an answer whose turn is still running can have more to say.
  if (!working || message.role !== "assistant" || message.status === "failed") {
    return null;
  }

  const hasContent = Arr.some(
    message.parts,
    (part) =>
      isToolUIPart(part) ||
      ((part.type === "text" || part.type === "reasoning") &&
        part.text.trim().length > 0)
  );

  if (hasContent) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <TypingLoader />
    </div>
  );
}
AiChatMessageLoading.displayName = "AiChatMessageLoading";
