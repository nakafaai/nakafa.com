"use client";

import type { MyUIMessage } from "@repo/ai/lib/types";
import { MessageContent } from "@repo/design-system/components/ai/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { Response } from "@repo/design-system/components/ai/response";
import type { ChatStatus } from "ai";
import { memo } from "react";
import { ArticlesTool } from "./articles-tool";
import { CalculatorTool } from "./calculator-tool";
import { AIChatMessageActions } from "./chat-actions";
import { AIChatLoading } from "./chat-loading";
import { ContentTool } from "./content-tool";
import { ScrapeTool } from "./scrape-tool";
import { SubjectsTool } from "./subjects-tool";
import { SuggestionsData } from "./suggestions-data";
import { WebSearchTool } from "./web-search-tool";

type Props = {
  message: MyUIMessage;
  regenerate: ({ messageId }: { messageId: string }) => void;
  status: ChatStatus;
};

export const AiChatMessage = memo(({ message, regenerate, status }: Props) => {
  if (message.parts.length === 0) {
    return <AIChatLoading force status={status} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text": {
            return (
              <div
                className="flex flex-col gap-2 group-[.is-user]:items-end group-[.is-user]:justify-end"
                key={`message-${message.id}-part-${i}`}
              >
                <MessageContent>
                  <Response id={message.id}>{part.text}</Response>
                </MessageContent>

                <AIChatMessageActions
                  messageId={message.id}
                  regenerate={regenerate}
                  text={part.text}
                />
              </div>
            );
          }
          case "reasoning":
            return (
              <Reasoning
                autoOpen={false}
                className="w-full"
                isStreaming={part.state === "streaming"}
                key={`reasoning-${message.id}-part-${i}`}
              >
                <ReasoningTrigger />
                <ReasoningContent id={message.id}>{part.text}</ReasoningContent>
              </Reasoning>
            );
          case "tool-getArticles":
            return (
              <ArticlesTool
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "tool-getSubjects":
            return (
              <SubjectsTool
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "tool-getContent":
            return (
              <ContentTool
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "tool-calculator":
            return (
              <CalculatorTool
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "tool-webSearch":
            return (
              <WebSearchTool
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "tool-scrape":
            return (
              <ScrapeTool
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "data-suggestions":
            return (
              <SuggestionsData
                key={`data-${part.id}`}
                suggestions={part.data}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
});

AiChatMessage.displayName = "AiChatMessage";
