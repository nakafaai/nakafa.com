"use client";

import { useClipboard } from "@mantine/hooks";
import type { MyUIMessage } from "@repo/ai/lib/types";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ai/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { Response } from "@repo/design-system/components/ai/response";
import { TypingLoader } from "@repo/design-system/components/ui/icons";
import type { ChatStatus } from "ai";
import { CheckIcon, CopyIcon, RefreshCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";
import { ArticlesTool } from "./articles-tool";
import { CalculatorTool } from "./calculator-tool";
import { ContentTool } from "./content-tool";
import { ScrapeTool } from "./scrape-tool";
import { SubjectsTool } from "./subjects-tool";
import { WebSearchTool } from "./web-search-tool";

export function AiChat() {
  const { messages, status, regenerate } = useChat((state) => state.chat);

  return (
    <main className="h-svh">
      <div className="relative flex size-full flex-col divide-y overflow-hidden">
        <Conversation>
          <ConversationContent className="mx-auto max-w-3xl">
            <AIChatMessages messages={messages} regenerate={regenerate} />
            <AIChatLoading status={status} />
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>
    </main>
  );
}

const AIChatLoading = memo(({ status }: { status: ChatStatus }) => {
  if (status !== "submitted") {
    return null;
  }

  return (
    <Message from="assistant" key="typing">
      <div className="flex flex-col gap-4">
        <TypingLoader />
      </div>
    </Message>
  );
});
AIChatLoading.displayName = "AIChatLoading";

const AIChatMessages = memo(
  ({
    messages,
    regenerate,
  }: {
    messages: MyUIMessage[];
    regenerate: ({ messageId }: { messageId: string }) => void;
  }) => {
    return messages.map((message) => (
      <Message
        from={message.role === "user" ? "user" : "assistant"}
        key={message.id}
      >
        <AIChatMessage message={message} regenerate={regenerate} />
      </Message>
    ));
  }
);
AIChatMessages.displayName = "AIChatMessages";

const AIChatMessage = memo(
  ({
    message,
    regenerate,
  }: {
    message: MyUIMessage;
    regenerate: ({ messageId }: { messageId: string }) => void;
  }) => {
    return (
      <div className="flex flex-col gap-4">
        {message.parts.map((part, i) => {
          switch (part.type) {
            case "text": {
              const isLastPart = i === message.parts.length - 1;
              return (
                <div
                  className="flex flex-col gap-2 group-[.is-user]:items-end group-[.is-user]:justify-end"
                  key={`message-${message.id}-part-${i}`}
                >
                  <MessageContent>
                    <Response id={message.id}>{part.text}</Response>
                  </MessageContent>
                  {isLastPart && (
                    <AIChatMessageActions
                      messageId={message.id}
                      regenerate={regenerate}
                      text={part.text}
                    />
                  )}
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
                  <ReasoningContent id={message.id}>
                    {part.text}
                  </ReasoningContent>
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
            default:
              return null;
          }
        })}
      </div>
    );
  }
);
AIChatMessage.displayName = "AIChatMessage";

const AIChatMessageActions = memo(
  ({
    messageId,
    text,
    regenerate,
  }: {
    messageId: string;
    text: string;
    regenerate: ({ messageId }: { messageId: string }) => void;
  }) => {
    const t = useTranslations("Ai");

    const clipboard = useClipboard({ timeout: 1000 });

    return (
      <Actions className="opacity-0 transition-opacity ease-out group-hover:opacity-100">
        <Action
          label={t("retry-message")}
          onClick={() => regenerate({ messageId })}
          tooltip={t("retry-message")}
        >
          <RefreshCcwIcon />
        </Action>
        <Action
          label={t("copy-message")}
          onClick={() => clipboard.copy(text)}
          tooltip={t("copy-message")}
        >
          {clipboard.copied ? <CheckIcon /> : <CopyIcon />}
        </Action>
      </Actions>
    );
  }
);
AIChatMessageActions.displayName = "AIChatMessageActions";
