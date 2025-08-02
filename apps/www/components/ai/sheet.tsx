"use client";

import { useChat } from "@ai-sdk/react";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import type { MyUIMessage } from "@repo/ai/lib/types";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import {
  AIInput,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "@repo/design-system/components/ai/input";
import {
  AIMessage,
  AIMessageContent,
} from "@repo/design-system/components/ai/message";
import { AIResponse } from "@repo/design-system/components/ai/response";
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
  EyeOffIcon,
  Maximize2Icon,
  Minimize2Icon,
  SparklesIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { useAi } from "@/lib/context/use-ai";
import { ContentTool } from "./content-tool";
import { ContentsTool } from "./contents-tool";
import { MathEvalTool } from "./matheval-tool";

const MIN_WIDTH = 448;
const MAX_WIDTH = 672;

export function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);

  const isMobile = useMediaQuery("(max-width: 768px)");

  useHotkeys([["mod+i", () => setOpen(!open)]]);

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MIN_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

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
                <EyeOffIcon />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <AiSheetContent />
      </SheetContent>
    </Sheet>
  );
}

function AiSheetContent() {
  const t = useTranslations("Ai");

  const locale = useLocale();
  const slug = usePathname();

  const { sendMessage, messages, status, stop } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: m }) => {
        return {
          body: {
            messages: m,
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
  });

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      <AIConversation>
        <AIConversationContent>
          <AISheetMessages messages={messages} />
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      <AISheetToolbar
        handleSubmit={(text) => sendMessage({ text })}
        status={status}
        stop={stop}
      />
    </div>
  );
}

function AISheetToolbar({
  status,
  stop,
  handleSubmit,
}: {
  status: ComponentProps<typeof AIInputSubmit>["status"];
  stop: () => void;
  handleSubmit: (message: string) => void;
}) {
  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const handleSendMessage = () => {
    if (text.trim()) {
      handleSubmit(text);
      setText("");
    }
  };

  return (
    <div className="grid shrink-0 gap-4">
      <AIInput
        className="rounded-none border-0 shadow-none"
        onSubmit={handleSendMessage}
      >
        <AIInputTextarea
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          value={text}
        />
        <AIInputToolbar>
          <AIInputTools />
          <AIInputSubmit
            disabled={!text.trim()}
            onClick={() => {
              if (status === "streaming") {
                stop();
                return;
              }
            }}
            status={status}
          />
        </AIInputToolbar>
      </AIInput>
    </div>
  );
}

function AISheetMessages({ messages }: { messages: MyUIMessage[] }) {
  return messages.map((message) => (
    <AIMessage
      from={message.role === "user" ? "user" : "assistant"}
      key={message.id}
    >
      <AISheetMessage message={message} />
    </AIMessage>
  ));
}

function AISheetMessage({ message }: { message: MyUIMessage }) {
  return (
    <div className="flex flex-col gap-4">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return (
              <AIMessageContent key={`message-${message.id}-part-${i}`}>
                <AIResponse content={part.text} id={message.id} />
              </AIMessageContent>
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
