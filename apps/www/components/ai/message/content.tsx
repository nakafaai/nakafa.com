"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isToolUIPart } from "ai";
import { useChat } from "@/components/ai/chat/context";
import { useMessage } from "@/components/ai/message/context";
import { AiMessagePart } from "@/components/ai/message/part";
import {
  MessageSection,
  MessageSections,
} from "@/components/ai/message/section";
import { SuggestionsPart } from "@/components/ai/message/suggestions";
import { useViewer } from "@/lib/identity/client";

export function AiChatMessageContent() {
  const parts = useMessage((state) => state.message.parts);
  const sections: {
    key: string;
    kind: "activity" | "response";
    parts: { part: NinaMessage["parts"][number]; key: string }[];
  }[] = [];

  // Streamed and saved copies of one message place step markers differently,
  // so parts are keyed by their position among parts of the same type. The
  // saved copy then replaces the stream in place and streamed text keeps pacing.
  const counts = new Map<string, number>();
  // Preserve Agent order while keeping consecutive work steps in one group.
  for (const part of parts) {
    if (
      part.type === "step-start" ||
      (part.type === "text" && part.text.trim().length === 0)
    ) {
      continue;
    }
    const tool = isToolUIPart(part);
    const kind = part.type === "reasoning" || tool ? "activity" : "response";
    const count = counts.get(part.type) ?? 0;
    counts.set(part.type, count + 1);
    const key = tool ? part.toolCallId : `${part.type}-${count}`;
    const section = sections.at(-1);
    const entry = { part, key };
    if (section?.kind === kind) {
      section.parts.push(entry);
    } else {
      sections.push({ key, kind, parts: [entry] });
    }
  }

  return (
    <MessageSections>
      {sections.map((section) => (
        <MessageSection key={section.key} kind={section.kind}>
          {section.parts.map(({ part, key }) => (
            <AiMessagePart key={key} part={part} partKey={key} />
          ))}
        </MessageSection>
      ))}
    </MessageSections>
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
