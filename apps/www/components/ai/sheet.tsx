"use client";

import { useMediaQuery } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundry";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import type { ChatStatus } from "ai";
import { Authenticated, useMutation, useQuery } from "convex/react";
import {
  Maximize2Icon,
  Minimize2Icon,
  ShapesIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from "react";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";
import { AIChatLoading } from "./chat-loading";
import { AiChatMessage } from "./chat-message";
import { AiChatModel } from "./chat-model";

const MIN_WIDTH = 384;
const MAX_WIDTH = 672;

export function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const activeChatId = useAi((state) => state.activeChatId);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MIN_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

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
                onClick={() => setActiveChatId(null)}
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

        <Activity mode={activeChatId ? "hidden" : "visible"}>
          <AiSheetNewChat />
        </Activity>
        <Activity mode={activeChatId ? "visible" : "hidden"}>
          <ErrorBoundary fallback={<AiSheetError />}>
            <Authenticated>
              {activeChatId && <AiSheetMain chatId={activeChatId} />}
            </Authenticated>
          </ErrorBoundary>
        </Activity>
      </SheetContent>
    </Sheet>
  );
}

const AiSheetError = memo(() => {
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  useEffect(() => {
    setActiveChatId(null);
  }, [setActiveChatId]);

  return null;
});
AiSheetError.displayName = "AiSheetError";

const AiSheetNewChat = memo(() => {
  const t = useTranslations("Ai");

  const router = useRouter();
  const pathname = usePathname();

  const setOpen = useAi((state) => state.setOpen);
  const setQuery = useAi((state) => state.setQuery);
  const setActiveChatId = useAi((state) => state.setActiveChatId);

  const user = useQuery(api.auth.getCurrentUser);
  const createChat = useMutation(api.chats.mutations.createChat);

  const [isPending, startTransition] = useTransition();

  function handleSubmit(message: PromptInputMessage) {
    startTransition(async () => {
      if (!message.text?.trim()) {
        return;
      }

      if (!user) {
        setOpen(false);
        router.push(`/auth?redirect=${pathname}`);
        return;
      }

      const chatId = await createChat({
        title: "New Chat",
      });

      setQuery(message.text);
      setActiveChatId(chatId);
    });
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent>
          <ConversationEmptyState
            description={t("new-chat-description")}
            icon={<ShapesIcon className="size-8 shrink-0" />}
            title={t("new-chat-title")}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <AiSheetInput
        disabled={isPending}
        isPending={isPending}
        key="ai-sheet-input"
        onSubmit={handleSubmit}
      />
    </div>
  );
});
AiSheetNewChat.displayName = "AiSheetNewChat";

const AiSheetMain = memo(({ chatId }: { chatId: Id<"chats"> }) => {
  const messages = useQuery(api.chats.queries.loadMessages, {
    chatId,
  });

  if (!messages) {
    return <AiSheetMainPlaceholder />;
  }

  return (
    <ChatProvider chatId={chatId} initialMessages={messages}>
      <AiSheetMainContent />
    </ChatProvider>
  );
});
AiSheetMain.displayName = "AiSheetMain";

const AiSheetMainPlaceholder = memo(() => (
  <div className="relative flex size-full flex-col overflow-hidden">
    <Conversation>
      <ConversationContent>
        <div />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>

    <AiSheetInput
      disabled={true}
      isPending={true}
      key="ai-sheet-input"
      onSubmit={() => {
        return;
      }}
    />
  </div>
));
AiSheetMainPlaceholder.displayName = "AiSheetMainPlaceholder";

const AiSheetMainContent = memo(() => {
  const query = useAi((state) => state.query);
  const setQuery = useAi((state) => state.setQuery);
  const setText = useAi((state) => state.setText);

  const sendMessage = useChat((state) => state.chat.sendMessage);

  const hasProcessedQuery = useRef(false);

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setText("");
  }, [setQuery, setText]);

  useEffect(() => {
    if (query && !hasProcessedQuery.current) {
      hasProcessedQuery.current = true;
      sendMessage({
        text: query,
      });
      handleClearQuery();
    }
  }, [query, sendMessage, handleClearQuery]);

  return <AiSheetContent />;
});

const AiSheetContent = memo(() => {
  const router = useRouter();
  const pathname = usePathname();

  const messages = useChat((state) => state.chat.messages);
  const setText = useAi((state) => state.setText);

  const user = useQuery(api.auth.getCurrentUser);
  const { sendMessage, status, stop } = useChat((state) => state.chat);

  function handleSubmit(message: PromptInputMessage) {
    if (status === "streaming") {
      stop();
      return;
    }

    if (!message.text?.trim()) {
      return;
    }

    if (!user) {
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    sendMessage({
      text: message.text,
      files: message.files,
    });
    setText("");
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
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

      <AiSheetInput
        disabled={status === "submitted"}
        key="ai-sheet-input"
        onSubmit={handleSubmit}
        status={status}
      />
    </div>
  );
});
AiSheetContent.displayName = "AiSheetContent";

const AiSheetInput = memo(
  ({
    onSubmit,
    disabled,
    status,
    isPending,
  }: {
    onSubmit: (message: PromptInputMessage) => void;
    disabled?: boolean;
    status?: ChatStatus;
    isPending?: boolean;
  }) => {
    const t = useTranslations("Ai");

    const text = useAi((state) => state.text);
    const setText = useAi((state) => state.setText);

    return (
      <div className="grid shrink-0 px-2 pb-2">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea
            onChange={(e) => setText(e.target.value)}
            placeholder={t("text-placeholder")}
            value={text}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <AiChatModel />
            </PromptInputTools>
            <PromptInputSubmit
              disabled={disabled}
              isPending={isPending}
              status={status}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    );
  }
);
AiSheetInput.displayName = "AiSheetInput";
