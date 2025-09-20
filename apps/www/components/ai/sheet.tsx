"use client";

import { useMediaQuery } from "@mantine/hooks";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/design-system/components/ai/input";
import { Message } from "@repo/design-system/components/ai/message";
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
  Maximize2Icon,
  Minimize2Icon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useAi } from "@/lib/context/use-ai";
import { useChat } from "@/lib/context/use-chat";
import { AIChatLoading } from "./chat-loading";
import { AiChatMessage } from "./chat-message";
import { AiChatModel } from "./chat-model";

const MIN_WIDTH = 448;
const MAX_WIDTH = 672;

export function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MIN_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

  const { messages, setMessages } = useChat((state) => state.chat);

  return (
    <Sheet defaultOpen={open} modal={false} onOpenChange={setOpen} open={open}>
      <SheetContent
        className={cn(
          "max-w-none gap-0 transition-[width] duration-0 sm:max-w-none",
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
                onClick={() => setMessages([])}
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
              {messages.map((message) => (
                <Message
                  from={message.role === "user" ? "user" : "assistant"}
                  key={message.id}
                >
                  <AiChatMessage message={message} />
                </Message>
              ))}

              <AIChatLoading />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <AISheetToolbar />
        </div>
      </SheetContent>
    </Sheet>
  );
}

const AISheetToolbar = memo(() => {
  const t = useTranslations("Ai");

  const text = useAi((state) => state.text);
  const setText = useAi((state) => state.setText);

  const { sendMessage, status, stop } = useChat((state) => state.chat);

  const handleSubmit = (message: PromptInputMessage) => {
    if (status === "streaming") {
      stop();
      return;
    }

    if (!message.text?.trim()) {
      return;
    }

    sendMessage({
      text: message.text,
      files: message.files,
    });
    setText("");
  };

  return (
    <div className="grid shrink-0">
      <PromptInput
        className="rounded-none border-0 shadow-none"
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          autoFocus
          onChange={(e) => setText(e.target.value)}
          placeholder={t("text-placeholder")}
          value={text}
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <AiChatModel />
          </PromptInputTools>
          <PromptInputSubmit
            disabled={status === "submitted"}
            status={status}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
});
AISheetToolbar.displayName = "AISheetToolbar";
