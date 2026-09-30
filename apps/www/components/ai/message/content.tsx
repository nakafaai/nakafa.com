"use client";

import { useChat } from "@/components/ai/chat/context";
import { useMessage } from "@/components/ai/message/context";
import { groupMessageParts } from "@/components/ai/message/group";
import { AiMessageAnswer, AiMessagePart } from "@/components/ai/message/part";
import {
  MessageSection,
  MessageSections,
} from "@/components/ai/message/section";
import { SuggestionsPart } from "@/components/ai/message/suggestions";
import { useViewer } from "@/lib/identity/client";

/** Renders a message's work steps and answers in Agent order. */
export function AiChatMessageContent() {
  const parts = useMessage((state) => state.message.parts);

  return (
    <MessageSections>
      {groupMessageParts(parts).map((group) => (
        <MessageSection key={group.key} kind={group.kind}>
          {group.entries.map((entry) =>
            entry.type === "answer" ? (
              <AiMessageAnswer
                key={entry.key}
                part={entry.part}
                partKey={entry.key}
              >
                {entry.trailing.map((trailing) => (
                  <AiMessagePart
                    key={trailing.key}
                    part={trailing.part}
                    partKey={trailing.key}
                  />
                ))}
              </AiMessageAnswer>
            ) : (
              <AiMessagePart
                key={entry.key}
                part={entry.part}
                partKey={entry.key}
              />
            )
          )}
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
