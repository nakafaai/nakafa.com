"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isToolUIPart } from "ai";
import { useChat } from "@/components/ai/chat/context";
import { useMessage } from "@/components/ai/message/context";
import { AiChatMessageLoading } from "@/components/ai/message/loading";
import { AiMessagePart } from "@/components/ai/message/part";
import { SuggestionsPart } from "@/components/ai/message/suggestions";
import { useViewer } from "@/lib/identity/client";

export function AiChatMessageContent() {
  const parts = useMessage((state) => state.message.parts);
  const sections: {
    key: string;
    activity: boolean;
    parts: { part: NinaMessage["parts"][number]; index: number; key: string }[];
  }[] = [];

  // Preserve Agent order while keeping consecutive work steps in one group.
  for (const [index, part] of parts.entries()) {
    if (
      part.type === "step-start" ||
      (part.type === "text" && part.text.trim().length === 0)
    ) {
      continue;
    }
    const tool = isToolUIPart(part);
    const activity = part.type === "reasoning" || tool;
    const key = tool ? part.toolCallId : `part-${part.type}-${index}`;
    const section = sections.at(-1);
    const entry = { part, index, key };
    if (section?.activity === activity) {
      section.parts.push(entry);
    } else {
      sections.push({ key, activity, parts: [entry] });
    }
  }

  return (
    <div className="flex flex-col gap-6 empty:hidden">
      {sections.map((section) => (
        <div
          className="flex min-w-0 flex-col gap-4 empty:hidden"
          data-slot={section.activity ? "message-activity" : "message-response"}
          key={section.key}
        >
          {section.parts.map(({ part, index, key }) => (
            <AiMessagePart key={key} part={part} partIndex={index} />
          ))}
        </div>
      ))}
      <AiChatMessageLoading />
    </div>
  );
}
AiChatMessageContent.displayName = "AiChatMessageContent";

export function AiChatMessageSuggestions() {
  const chat = useChat((s) => s.chat);

  const currentUser = useViewer((s) => s.account);
  const showSuggestions = chat?.userId === currentUser?.appUser._id;
  const suggestions = useMessage((state) =>
    state.message.role === "assistant" &&
    state.turn?.state.status === "complete"
      ? state.turn.suggestions
      : undefined
  );

  if (!(showSuggestions && suggestions)) {
    return null;
  }

  return <SuggestionsPart suggestions={suggestions} />;
}
AiChatMessageSuggestions.displayName = "AiChatMessageSuggestions";
