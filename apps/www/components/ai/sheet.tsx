"use client";

import {
  Add01Icon,
  Cancel01Icon,
  ChatSearch01Icon,
  GeometricShapes01Icon,
  Globe02Icon,
  Maximize03Icon,
  Minimize03Icon,
  SparklesIcon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import {
  Authenticated,
  Unauthenticated,
  useMutation,
  usePaginatedQuery,
} from "convex/react";
import { useTranslations } from "next-intl";
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useTransition,
} from "react";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";
import { useUser } from "@/lib/context/use-user";
import { AIChatLoading } from "./chat-loading";
import { AiChatMessage } from "./chat-message";
import { AiChatModel } from "./chat-model";
import { CurrentChatProvider, useCurrentChat } from "./chat-provider";

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
    <Sheet
      disablePointerDismissal
      modal={false}
      onOpenChange={setOpen}
      open={open}
    >
      <SheetContent
        className={cn(
          "max-w-none gap-0 border-l-0 sm:max-w-none sm:border-l",
          !!isResizing && "transition-none"
        )}
        showCloseButton={false}
        style={{ width: isMobile ? "100%" : `${width}px` }}
      >
        <button
          className={cn(
            "absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize outline-0 ring-0 transition-colors hover:bg-accent",
            !!isResizing && "bg-accent",
            !!isMobile && "hidden"
          )}
          onKeyDown={resizerProps.onKeyDown}
          onMouseDown={resizerProps.onMouseDown}
          type="button"
        />
        <SheetHeader className="border-b p-3">
          <SheetTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 px-2">
              <div className="flex items-center gap-2 text-base">
                <HugeIcons className="size-4" icon={SparklesIcon} />
                <span>Nina</span>
              </div>
              <Badge variant="secondary">Beta</Badge>
            </div>

            <div className="flex items-center">
              <Activity mode={activeChatId ? "visible" : "hidden"}>
                <Button
                  onClick={() => setActiveChatId(null)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <HugeIcons icon={Add01Icon} />
                  <span className="sr-only">New Chat</span>
                </Button>
              </Activity>
              <AiSheetHistory />
              <Button
                onClick={() => {
                  setWidth(
                    width === MAX_WIDTH ? (MIN_WIDTH ?? 0) : (MAX_WIDTH ?? 0)
                  );
                }}
                size="icon-sm"
                variant="ghost"
              >
                <HugeIcons
                  icon={width === MAX_WIDTH ? Minimize03Icon : Maximize03Icon}
                />
                <span className="sr-only">Resize</span>
              </Button>
              <Button
                onClick={() => setOpen(false)}
                size="icon-sm"
                variant="ghost"
              >
                <HugeIcons icon={Cancel01Icon} />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Nina is a chatbot that can help you with your questions.
          </SheetDescription>
        </SheetHeader>

        <Activity mode={activeChatId ? "hidden" : "visible"}>
          <AiSheetNewChat />
        </Activity>
        <Activity mode={activeChatId ? "visible" : "hidden"}>
          <ErrorBoundary fallback={<AiSheetError />}>
            <Authenticated>
              {!!activeChatId && (
                <CurrentChatProvider chatId={activeChatId}>
                  <AiSheetMain />
                </CurrentChatProvider>
              )}
            </Authenticated>
            <Unauthenticated>
              <AiSheetNewChat />
            </Unauthenticated>
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

  const user = useUser((s) => s.user);
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
        type: "study",
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
            icon={<HugeIcons className="size-6" icon={GeometricShapes01Icon} />}
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

const AiSheetHistory = memo(() => {
  const user = useUser((s) => s.user);

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost">
          <HugeIcons icon={ChatSearch01Icon} />
          <span className="sr-only">History</span>
        </Button>
      </DropdownMenuTrigger>
      <Authenticated>
        <AiSheetHistoryContent userId={user.appUser._id} />
      </Authenticated>
    </DropdownMenu>
  );
});
AiSheetHistory.displayName = "AiSheetHistory";

const AiSheetHistoryContent = memo(({ userId }: { userId: Id<"users"> }) => {
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const { results, status } = usePaginatedQuery(
    api.chats.queries.getChats,
    { userId, type: "study" },
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage" || results.length === 0) {
    return null;
  }

  return (
    <DropdownMenuContent align="end" className="max-h-64">
      <DropdownMenuGroup>
        {results.map((chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <DropdownMenuItem
              className="cursor-pointer"
              key={chat._id}
              onSelect={() => {
                setActiveChatId(chat._id);
              }}
            >
              <HugeIcons icon={isPrivate ? SquareLock01Icon : Globe02Icon} />
              <span className="max-w-62.5 truncate">{chat.title}</span>
              <DropdownMenuShortcut>
                <HugeIcons
                  className={cn(
                    "transition-opacity ease-out",
                    activeChatId === chat._id ? "opacity-100" : "opacity-0"
                  )}
                  icon={Tick01Icon}
                />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
});

const AiSheetMain = memo(() => {
  const chat = useCurrentChat((s) => s.chat);
  const messages = useCurrentChat((s) => s.messages);

  if (!(chat && messages)) {
    return <AiSheetMainPlaceholder />;
  }

  return (
    <ChatProvider chatId={chat._id} initialMessages={messages}>
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

  const lastProcessedQuery = useRef<string | null>(null);

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setText("");
  }, [setQuery, setText]);

  const handleQuery = useEffectEvent((text: string) => {
    sendMessage({ text });
    handleClearQuery();
  });

  useEffect(() => {
    if (query && query !== lastProcessedQuery.current) {
      lastProcessedQuery.current = query;
      handleQuery(query);
    }
  }, [query]);

  return <AiSheetContent />;
});

const AiSheetContent = memo(() => {
  const router = useRouter();
  const pathname = usePathname();

  const messages = useChat((state) => state.chat.messages);
  const setText = useAi((state) => state.setText);

  const user = useUser((s) => s.user);
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
            aria-label={t("text-placeholder")}
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
