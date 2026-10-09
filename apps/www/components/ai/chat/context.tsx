"use client";

import { Ref } from "@confect/core";
import {
  type OptimisticUpdate,
  QueryResult,
  useMutation,
  useQuery,
} from "@confect/react";
import { type UIMessagesQuery, useUIMessages } from "@convex-dev/agent/react";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Array as Arr, DateTime, Effect, Option, Result } from "effect";
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useAi } from "@/components/ai/context";
import { NinaConnectionError } from "@/components/ai/feedback";
import { type NinaDraft, useNinaSubmission } from "@/components/ai/submission";
import { useConvexAuth } from "@/components/providers/convex";
import { useViewer } from "@/lib/identity/client";

// Agent owns delta decoding, reconnection and pagination. Confect registers
// and authorizes the query; the streaming hook uses the SDK reference boundary.
type MessageFeed = UIMessagesQuery<
  Pick<Ref.Args<typeof nina.messages.list>, "chatId">,
  NinaMessage
>;
type MessagesQuery = FunctionReference<
  "query",
  "public",
  FunctionArgs<MessageFeed>,
  FunctionReturnType<MessageFeed> &
    Required<Pick<FunctionReturnType<MessageFeed>, "streams">>
>;
const messagesQuery: MessagesQuery = Ref.getFunctionReference(
  nina.messages.list
);
// Declared outside the provider: a type query naming `cancel` inside it
// stops the React Compiler from memoizing the provider's `cancel` action.
type CancelError = Ref.Error<typeof nina.lifecycle.cancel>;

const ChatContext = createContext<ChatContextValue | null>(null);
const ChatMessagesContext = createContext<ChatMessagesValue | null>(null);

const optimisticCancel: OptimisticUpdate<typeof nina.lifecycle.cancel> = (
  store,
  args
) => {
  const current = store.getQuery(nina.conversation.get, args);
  if (Option.isNone(current) || !current.value.turn) {
    return;
  }
  const turn = current.value.turn;
  if (turn.state.status !== "running" && turn.state.status !== "queued") {
    return;
  }
  store.setQuery(
    nina.conversation.get,
    args,
    Option.some({
      ...current.value,
      turn: {
        ...turn,
        state: {
          status: "cancelled",
          finishedAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
        },
      },
    })
  );
};

/** Keeps admitted and optimistic prompts stable until the Agent feed catches up. */
function useMessages(
  chatId: Id<"chats">,
  chat: Docs["chats"] | undefined,
  pagination: ReturnType<typeof useUIMessages<MessagesQuery>>
) {
  const openingChat = useAi((state) => state.openingChat);
  const setOpeningChat = useAi((state) => state.setOpeningChat);
  const [draft, showDraft] = useOptimistic<{
    prompt: NinaDraft;
    order: number;
    createdAt: number;
  } | null>(null);
  const isLoading = !chat || pagination.status === "LoadingFirstPage";
  const opening = openingChat?.receipt.chatId === chatId ? openingChat : null;
  useEffect(() => {
    if (opening && !isLoading) {
      setOpeningChat(null);
    }
  }, [opening, isLoading, setOpeningChat]);

  // Carry the committed first prompt across navigation until the Agent query
  // arrives. It is scoped to this chat and never persisted in browser storage.
  const committed: NinaMessage[] =
    opening && isLoading
      ? [
          {
            id: opening.receipt.promptMessageId,
            key: `${opening.receipt.threadId}-${opening.receipt.order}-0`,
            order: opening.receipt.order,
            stepOrder: 0,
            role: "user",
            status: "success",
            text: opening.prompt.text,
            parts: [
              { type: "text", text: opening.prompt.text },
              ...Arr.map(opening.prompt.files, ({ filename, ...file }) => ({
                ...file,
                ...(filename === undefined ? {} : { filename }),
                type: "file" as const,
              })),
            ],
            _creationTime: opening.submittedAt,
          },
        ]
      : pagination.results;
  const messages: NinaMessage[] =
    draft &&
    !Arr.some(
      committed,
      (message) => message.role === "user" && message.order >= draft.order
    )
      ? [
          ...committed,
          {
            id: `draft-${chatId}`,
            key: `${chat?.threadId}-${draft.order}-0`,
            order: draft.order,
            stepOrder: 0,
            role: "user",
            status: "pending",
            text: draft.prompt.text,
            parts: [
              { type: "text", text: draft.prompt.text },
              ...Arr.map(draft.prompt.files ?? [], ({ file, url }) => ({
                type: "file" as const,
                url,
                filename: file.name,
                mediaType: file.type,
              })),
            ],
            _creationTime: draft.createdAt,
          },
        ]
      : committed;
  return { messages, showDraft, opening, isLoading };
}

/** Combines authorized conversation facts with the official Agent stream. */
function useConversation(chatId: Id<"chats">) {
  const authenticating = useConvexAuth((auth) => auth.isLoading);
  const result = useQuery(
    nina.conversation.get,
    authenticating ? "skip" : { chatId }
  );
  const chat = QueryResult.isSuccess(result) ? result.value.chat : undefined;
  const turn = QueryResult.isSuccess(result) ? result.value.turn : null;
  const pagination = useUIMessages(
    messagesQuery,
    chat?.threadId ? { chatId, threadId: chat.threadId } : "skip",
    { initialNumItems: NINA_MESSAGES_PAGE_SIZE, stream: true }
  );
  if (QueryResult.isFailure(result)) {
    throw result.error;
  }
  return { chat, turn, pagination };
}

/** Owns one conversation's reactive state and actions for ChatProvider. */
function useChatState(chatId: Id<"chats">) {
  const { chat, turn, pagination } = useConversation(chatId);
  const submission = useNinaSubmission();
  const [isPending, startTransition] = useTransition();
  const [cancelling, optimisticallyCancel] = useOptimistic(false);
  const setText = useAi((state) => state.setText);
  const viewer = useViewer((state) => state.viewer);
  const cancelTurn = useMutation(nina.lifecycle.cancel).withOptimisticUpdate(
    optimisticCancel
  );
  const [cancelError, setCancelError] = useState<
    CancelError | NinaConnectionError | null
  >(null);

  const { messages, showDraft, opening, isLoading } = useMessages(
    chatId,
    chat,
    pagination
  );
  const lastMessage = Arr.last(messages);
  const busy =
    !cancelling &&
    (isPending ||
      (!!opening && isLoading) ||
      (turn?.state.status !== "cancelled" &&
        Option.exists(
          lastMessage,
          (message) => message.status === "pending"
        )) ||
      turn?.state.status === "queued" ||
      turn?.state.status === "running");
  // Actions read the transcript when they run, so they stay the same functions
  // while tokens stream instead of re-rendering every control that holds one.
  const latestMessages = useRef(messages);
  const latestPagination = useRef(pagination);
  useLayoutEffect(() => {
    latestMessages.current = messages;
    latestPagination.current = pagination;
  });

  function loadMore() {
    latestPagination.current.loadMore(NINA_MESSAGES_PAGE_SIZE);
  }

  function send(prompt: NinaDraft) {
    if (busy || isLoading || isPending) {
      return Promise.resolve(false);
    }
    setCancelError(null);
    setText((previous) =>
      previous.trim() === prompt.text.trim() ? "" : previous
    );
    const admission = submission.send(prompt, chatId);
    startTransition(async () => {
      showDraft({
        prompt,
        order:
          1 +
          Math.max(
            -1,
            ...Arr.map(latestMessages.current, (message) => message.order)
          ),
        createdAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
      });
      const receipt = await admission;
      if (!receipt) {
        setText((previous) => previous || prompt.text);
      }
    });
    return admission.then((receipt) => receipt !== undefined);
  }

  function cancel() {
    if (isPending) {
      return;
    }
    setCancelError(null);
    startTransition(async () => {
      optimisticallyCancel(true);
      const cancelled = await Effect.runPromise(
        Effect.tryPromise({
          try: () => cancelTurn({ chatId }),
          catch: () =>
            new NinaConnectionError({
              code: "NINA_CONNECTION_FAILED",
              message: "Nina cancellation could not be confirmed.",
            }),
        }).pipe(Effect.flatMap(Effect.fromResult), Effect.result)
      );
      if (Result.isFailure(cancelled)) {
        setCancelError(cancelled.failure);
      }
    });
  }

  function retry(order?: number) {
    const prompt = Arr.findFirst(
      Arr.reverse(latestMessages.current),
      (message) =>
        message.role === "user" &&
        (order === undefined || message.order === order)
    );
    if (Option.isNone(prompt)) {
      return;
    }
    if (busy || isLoading || isPending) {
      return;
    }
    startTransition(async () => {
      await submission.retry(prompt.value.order, chatId);
    });
  }

  const value = {
    canWrite: !!viewer && (chat ? chat.userId === viewer.id : opening !== null),
    chat,
    turn,
    busy,
    isLoading,
    isPending,
    error: submission.error ?? cancelError,
    /** Whether the assistant's reply to the current turn failed in the transcript. */
    hasTurnFailure: Arr.some(
      messages,
      (message) =>
        message.role === "assistant" &&
        message.order === turn?.order &&
        message.status === "failed"
    ),
    /** Whether the transcript already ends with the reply to the current turn. */
    hasTurnResponse: Option.exists(
      lastMessage,
      (message) => message.role === "assistant" && message.order === turn?.order
    ),
    lastMessageId: Option.getOrUndefined(
      Option.map(lastMessage, (message) => message.id)
    ),
    canLoadMore: pagination.status === "CanLoadMore",
    loadMore,
    send,
    cancel,
    retry,
  };
  const feed = { messages };
  return { feed, value };
}

/**
 * The conversation's state and actions. It changes when a turn starts, ends
 * or fails, never with a streamed token, so the controls that read it stay
 * still while Nina writes.
 */
type ChatContextValue = ReturnType<typeof useChatState>["value"];

/** The transcript itself, which changes with every streamed token. */
type ChatMessagesValue = ReturnType<typeof useChatState>["feed"];

/** One reactive conversation shared by the route, sheet and message controls. */
export function ChatProvider({
  chatId,
  children,
}: PropsWithChildren<{ chatId: Id<"chats"> }>) {
  const { feed, value } = useChatState(chatId);
  return (
    <ChatContext value={value}>
      <ChatMessagesContext value={feed}>{children}</ChatMessagesContext>
    </ChatContext>
  );
}

/** Selects one part of the conversation's state and actions. */
export function useChat<T>(selector: (state: ChatContextValue) => T) {
  const value = use(ChatContext);
  if (!value) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return selector(value);
}

/** Selects one part of the streamed transcript; readers re-render per token. */
export function useChatMessages<T>(selector: (feed: ChatMessagesValue) => T) {
  const feed = use(ChatMessagesContext);
  if (!feed) {
    throw new Error("useChatMessages must be used within ChatProvider");
  }
  return selector(feed);
}
