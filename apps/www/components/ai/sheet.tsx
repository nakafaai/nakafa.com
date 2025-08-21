"use client";

import { useChat } from "@ai-sdk/react";
import { useClipboard, useHotkeys, useMediaQuery } from "@mantine/hooks";
import type { MyUIMessage } from "@repo/ai/lib/types";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input";
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
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "@repo/design-system/lib/utils";
import { DefaultChatTransport } from "ai";
import {
  CheckIcon,
  CopyIcon,
  Maximize2Icon,
  Minimize2Icon,
  RefreshCcwIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { useAi, useAiHydrated } from "@/lib/context/use-ai";
import { ArticlesTool } from "./articles-tool";
import { CalculatorTool } from "./calculator-tool";
import { ContentTool } from "./content-tool";
import { SubjectsTool } from "./subjects-tool";

const MIN_WIDTH = 448;
const MAX_WIDTH = 672;

export function AiChat() {
  const hydrated = useAiHydrated();
  const currentMessages = useAi((state) => state.currentMessages);

  // Avoiding empty initial messages in useChat because of hydration issues
  if (!hydrated) {
    return null;
  }

  return <AiSheet initialMessages={currentMessages} />;
}

export function AiSheet({
  initialMessages,
}: {
  initialMessages: MyUIMessage[];
}) {
  const t = useTranslations("Ai");

  const setCurrentMessages = useAi((state) => state.setCurrentMessages);
  const appendCurrentMessages = useAi((state) => state.appendCurrentMessages);
  const clearCurrentMessages = useAi((state) => state.clearCurrentMessages);

  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);

  const isMobile = useMediaQuery("(max-width: 768px)");

  useHotkeys([["mod+i", () => setOpen(!open)]]);

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MIN_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

  const { sendMessage, messages, status, stop, setMessages, regenerate } =
    useChat<MyUIMessage>({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages: ms }) => {
          const currentUrl = window.location.href;
          const url = new URL(currentUrl);

          const locale = url.pathname.split("/")[1];
          const slug = `/${url.pathname.split("/").slice(2).join("/")}`;

          setCurrentMessages(ms);

          return {
            body: {
              messages: ms,
              url: currentUrl,
              locale,
              slug,
            },
          };
        },
      }),
      experimental_throttle: 50,
      onError: (error) => {
        toast.error(
          error.message.length > 0 ? error.message : t("error-message"),
          { position: "bottom-center" }
        );
      },
      onFinish: ({ message }) => {
        appendCurrentMessages(message);
      },
    });

  const handleClearMessages = () => {
    setMessages([]);
    clearCurrentMessages();
  };

  return (
    <Sheet defaultOpen={open} modal={false} onOpenChange={setOpen} open={open}>
      <SheetContent
        className={cn(
          "max-w-none gap-0 transition-all duration-0 sm:max-w-none",
          isResizing && "transition-none"
        )}
        closeButton={false}
        style={{ width: isMobile ? "100%" : `${width}px` }}
      >
        <button
          className={cn(
            "-left-1 absolute top-0 bottom-0 z-10 w-1 cursor-col-resize outline-0 ring-0 transition-colors hover:bg-accent",
            isResizing && "bg-accent",
            isMobile && "hidden"
          )}
          onKeyDown={resizerProps.onKeyDown}
          onMouseDown={resizerProps.onMouseDown}
          type="button"
        />
        <SheetHeader className="border-b py-3">
          <SheetTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-base">
                <SparklesIcon className="size-4" />
                <span>Nina</span>
              </div>
              <Badge variant="secondary">Beta</Badge>
            </div>

            <div className="flex items-center">
              <Button
                onClick={handleClearMessages}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2Icon />
                <span className="sr-only">Clear</span>
              </Button>
              <Button
                onClick={() => {
                  setWidth(width === MAX_WIDTH ? MIN_WIDTH : MAX_WIDTH);
                }}
                size="icon-sm"
                variant="ghost"
              >
                {width === MAX_WIDTH ? <Minimize2Icon /> : <Maximize2Icon />}
                <span className="sr-only">Resize</span>
              </Button>
              <Button
                onClick={() => setOpen(false)}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="relative flex size-full flex-col divide-y overflow-hidden">
          <Conversation>
            <ConversationContent>
              <AISheetMessages messages={messages} regenerate={regenerate} />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <AISheetToolbar
            handleSubmit={(text) => sendMessage({ text })}
            status={status}
            stop={stop}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AISheetToolbar({
  status,
  stop,
  handleSubmit,
}: {
  status: ComponentProps<typeof PromptInputSubmit>["status"];
  stop: () => void;
  handleSubmit: (message: string) => void;
}) {
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "streaming") {
      stop();
      return;
    }

    if (text.trim()) {
      handleSubmit(text);
      setText("");
    }
  };

  return (
    <div className="grid shrink-0 gap-4">
      <PromptInput
        className="rounded-none border-0 shadow-none"
        onSubmit={handleSendMessage}
      >
        <PromptInputTextarea
          autoFocus
          onChange={(e) => setText(e.target.value)}
          value={text}
        />
        <PromptInputToolbar>
          <PromptInputTools />
          <PromptInputSubmit
            disabled={status === "submitted"}
            status={status}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

function AISheetMessages({
  messages,
  regenerate,
}: {
  messages: MyUIMessage[];
  regenerate: ({ messageId }: { messageId: string }) => void;
}) {
  return messages.map((message) => (
    <Message
      from={message.role === "user" ? "user" : "assistant"}
      key={message.id}
    >
      <AISheetMessage message={message} regenerate={regenerate} />
    </Message>
  ));
}

function AISheetMessage({
  message,
  regenerate,
}: {
  message: MyUIMessage;
  regenerate: ({ messageId }: { messageId: string }) => void;
}) {
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
                  <AISheetMessageActions
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
                <ReasoningContent id={message.id}>{part.text}</ReasoningContent>
              </Reasoning>
            );
          case "tool-getArticles":
            return (
              <ArticlesTool
                input={part.input}
                key={`tool-${part.toolCallId}`}
                output={part.output}
                status={part.state}
              />
            );
          case "tool-getSubjects":
            return (
              <SubjectsTool
                input={part.input}
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
          default:
            return null;
        }
      })}
    </div>
  );
}

function AISheetMessageActions({
  messageId,
  text,
  regenerate,
}: {
  messageId: string;
  text: string;
  regenerate: ({ messageId }: { messageId: string }) => void;
}) {
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
