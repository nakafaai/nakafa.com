"use client";

import { useChat } from "@ai-sdk/react";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import type { MyUIMessage } from "@repo/ai/lib/types";
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
import { usePathname } from "@repo/internationalization/src/navigation";
import { DefaultChatTransport } from "ai";
import {
  Maximize2Icon,
  Minimize2Icon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { useAi, useAiHydrated } from "@/lib/context/use-ai";
import { ContentTool } from "./content-tool";
import { ContentsTool } from "./contents-tool";
import { MathEvalTool } from "./matheval-tool";

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

  const locale = useLocale();
  const slug = usePathname();

  const setCurrentMessages = useAi((state) => state.setCurrentMessages);
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

  const { sendMessage, messages, status, stop, setMessages } =
    useChat<MyUIMessage>({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages: ms }) => {
          setCurrentMessages(ms);

          return {
            body: {
              messages: ms,
              slug,
              locale,
            },
          };
        },
      }),
      onError: (error) => {
        toast.error(
          error.message.length > 0 ? error.message : t("error-message"),
          { position: "bottom-center" }
        );
      },
      onFinish: ({ message }) => {
        setCurrentMessages([message]);
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
              <AISheetMessages messages={messages} />
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

function AISheetMessages({ messages }: { messages: MyUIMessage[] }) {
  return messages.map((message) => (
    <Message
      from={message.role === "user" ? "user" : "assistant"}
      key={message.id}
    >
      <AISheetMessage message={message} />
    </Message>
  ));
}

function AISheetMessage({ message }: { message: MyUIMessage }) {
  return (
    <div className="flex flex-col gap-4">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return (
              <MessageContent key={`message-${message.id}-part-${i}`}>
                <Response id={message.id}>{part.text}</Response>
              </MessageContent>
            );
          case "reasoning":
            return (
              <Reasoning
                className="w-full"
                isStreaming={part.state === "streaming"}
                key={`reasoning-${message.id}-part-${i}`}
              >
                <ReasoningTrigger />
                <ReasoningContent id={message.id}>{part.text}</ReasoningContent>
              </Reasoning>
            );
          case "tool-getContents":
            return (
              <ContentsTool
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
          case "tool-mathEval":
            return (
              <MathEvalTool
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
