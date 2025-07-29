"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
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
import {
  EyeOffIcon,
  Maximize2Icon,
  Minimize2Icon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAi } from "@/lib/context/use-ai";

const MIN_WIDTH = 448;
const MAX_WIDTH = 672;

export function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);

  const isMobile = useMediaQuery("(max-width: 768px)");

  useHotkeys([["mod+i", () => setOpen(!open)]]);

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MAX_WIDTH,
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
          aria-orientation="vertical"
          aria-valuemax={MAX_WIDTH}
          aria-valuemin={MIN_WIDTH}
          aria-valuenow={width}
          className={cn(
            "-left-1 absolute top-0 bottom-0 z-10 w-1 cursor-col-resize outline-0 ring-0 transition-colors hover:bg-accent",
            isResizing && "bg-accent",
            isMobile && "hidden"
          )}
          onKeyDown={resizerProps.onKeyDown}
          onMouseDown={resizerProps.onMouseDown}
          role="separator"
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
  const [text, setText] = useState("");

  const { sendMessage, messages, status, stop } = useChat({
    onError: (error) => {
      toast.error(
        error.message.length > 0
          ? error.message
          : "An error occurred, please try again later.",
        { position: "bottom-center" }
      );
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage({ text });
    setText("");
  };

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <AIConversation>
        <AIConversationContent>
          <AISheetMessages messages={messages} />
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      <div className="grid shrink-0 gap-4 px-4 pb-3">
        <AIInput onSubmit={handleSubmit}>
          <AIInputTextarea
            onChange={(e) => setText(e.target.value)}
            value={text}
          />
          <AIInputToolbar>
            <AIInputTools />
            <AIInputSubmit
              disabled={!text}
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
    </div>
  );
}

function AISheetMessages({ messages }: { messages: UIMessage[] }) {
  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => (
        <AIMessage
          from={message.role === "user" ? "user" : "assistant"}
          key={message.id}
        >
          <AISheetMessage message={message} />
        </AIMessage>
      ))}
    </div>
  );
}

function AISheetMessage({ message }: { message: UIMessage }) {
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return (
              <AIMessageContent key={`message-${message.id}-part-${i}`}>
                <p className="whitespace-pre-wrap text-pretty break-words">
                  {part.text}
                </p>
              </AIMessageContent>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
