"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateTime, Effect, Fiber } from "effect";
import {
  createContext,
  type PropsWithChildren,
  use,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { readChatAccess } from "@/components/ai/chat/access";
import { isChatBusy } from "@/components/ai/chat/busy";
import { optimisticCancel } from "@/components/ai/chat/cancel";
import { draftMessage } from "@/components/ai/chat/messages";
import {
  type ChatStoreApi,
  ChatStoreContext,
  createChatStore,
} from "@/components/ai/chat/store.client";
import { useAi } from "@/components/ai/context";
import { NinaConnectionError } from "@/components/ai/feedback";
import { type NinaDraft, useNinaSubmission } from "@/components/ai/submission";
import { useConvexAuth } from "@/components/providers/convex";
import { useViewer } from "@/lib/identity/client";

const ChatContext = createContext<ChatContextValue | null>(null);

/** Reads the authorized facts of one conversation: its chat and latest turn. */
function useConversation(chatId: Id<"chats">) {
  const authenticating = useConvexAuth((auth) => auth.isLoading);
  const result = useQuery(
    nina.conversation.get,
    authenticating ? "skip" : { chatId }
  );
  if (QueryResult.isFailure(result)) {
    throw result.error;
  }
  return {
    chat: QueryResult.isSuccess(result) ? result.value.chat : undefined,
    turn: QueryResult.isSuccess(result) ? result.value.turn : null,
  };
}

/**
 * Owns one conversation's state and actions. It never reads the streamed
 * messages, which only the transcript does, so it does not render while text
 * streams. Each action is one function for the life of the provider and
 * reads the latest render when it runs.
 */
function useChatState(chatId: Id<"chats">, store: ChatStoreApi) {
  const { chat, turn } = useConversation(chatId);
  const submission = useNinaSubmission(store.getState().setSubmissionFailure);
  const [isPending, startTransition] = useTransition();
  const [cancelling, optimisticallyCancel] = useOptimistic(false);
  const [draft, showDraft] = useOptimistic<NinaMessage | null>(null);
  const setText = useAi((state) => state.setText);
  const opening = useAi(
    (state) => state.openingChat?.receipt.chatId === chatId
  );
  const viewerId = useViewer((state) => state.viewer?.id);
  const cancelChat = useMutation(nina.lifecycle.cancel);

  const loading = !chat;
  const busy = isChatBusy({
    cancelling,
    loading,
    opening,
    pending: isPending,
    status: turn?.state.status,
  });
  const { canWrite, owner } = readChatAccess({
    chatUserId: chat?.userId,
    loading,
    opening,
    viewerId,
  });

  // The actions below read this when they run, so they never go stale.
  const snapshot = {
    busy,
    cancelChat,
    chat,
    chatId,
    isPending,
    optimisticallyCancel,
    setText,
    showDraft,
    startTransition,
    submission,
    turn,
  };
  const latest = useRef(snapshot);
  useLayoutEffect(() => {
    latest.current = snapshot;
  });

  const [actions] = useState(() => ({
    cancel() {
      const now = latest.current;
      if (now.isPending) {
        return;
      }
      const { setStopFailure } = store.getState();
      setStopFailure(null);
      const stoppedOrder = now.turn?.order;
      const cancelTurn = now.cancelChat.withOptimisticUpdate(
        optimisticCancel(DateTime.toEpochMillis(DateTime.nowUnsafe()))
      );
      // The stop starts before the transition, so Convex shows the cancelled
      // turn at once: an update made inside a transition waits for its end.
      const stopping = Effect.runPromise(
        Effect.tryPromise({
          try: () => cancelTurn({ chatId: now.chatId }),
          catch: () =>
            new NinaConnectionError({
              code: "NINA_CONNECTION_FAILED",
              message: "Nina cancellation could not be confirmed.",
            }),
        }).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onFailure: (failure) =>
              Effect.sync(() =>
                setStopFailure({ failure, order: stoppedOrder })
              ),
            onSuccess: () => Effect.void,
          })
        )
      );
      now.startTransition(() => {
        now.optimisticallyCancel(true);
        return stopping;
      });
    },
    /** Sends the same prompt again, or the latest one when no turn is named. */
    retry(order?: number) {
      const now = latest.current;
      const target = order ?? now.turn?.order;
      if (target === undefined || !now.chat || now.busy || now.isPending) {
        return;
      }
      // The retry starts before the transition, for the same reason as a stop.
      const retrying = now.submission.retry(target, now.chatId);
      now.startTransition(() =>
        Effect.runPromise(Effect.asVoid(Effect.promise(() => retrying)))
      );
    },
    /**
     * Sends a prompt. The send starts at once and its one outcome has two
     * readers: the transition that holds the optimistic prompt, and the
     * composer, which keeps the learner's text and files until it knows the
     * prompt was admitted. A prompt that was not admitted returns to the
     * composer, unless the learner has typed something else since. The text
     * is one draft for every chat, so a prompt that fails after the learner
     * opened another chat returns to the composer open then, and its files
     * stay with the composer they were added in.
     */
    send(prompt: NinaDraft) {
      const now = latest.current;
      const chat = now.chat;
      if (!chat || now.busy || now.isPending) {
        return false;
      }
      now.setText((previous) =>
        previous.trim() === prompt.text.trim() ? "" : previous
      );
      const admission = Effect.runFork(
        Effect.promise(() => now.submission.send(prompt, now.chatId)).pipe(
          Effect.map((receipt) => receipt !== undefined),
          Effect.tap((admitted) =>
            admitted
              ? Effect.void
              : Effect.sync(() =>
                  now.setText((previous) => previous || prompt.text)
                )
          )
        )
      );
      now.startTransition(() => {
        now.showDraft(
          draftMessage({
            chatId: now.chatId,
            createdAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
            prompt,
            threadId: chat.threadId,
            turnOrder: now.turn?.order,
          })
        );
        return Effect.runPromise(Effect.asVoid(Fiber.join(admission)));
      });
      return Effect.runPromise(Fiber.join(admission));
    },
  }));

  return {
    busy,
    cancel: actions.cancel,
    canWrite,
    chat,
    chatId,
    draft,
    isLoading: loading,
    isPending,
    owner,
    retry: actions.retry,
    send: actions.send,
    turn,
  };
}

/**
 * The conversation's state and actions. It changes when a turn starts, ends
 * or fails, never with a streamed token, so the controls that read it stay
 * still while Nina writes.
 */
type ChatContextValue = ReturnType<typeof useChatState>;

/**
 * One reactive conversation shared by the route, sheet and message controls.
 * Each chat gets its own state and its own subtree, so choosing another chat
 * starts with none of the previous chat's error, stop, send or pending prompt,
 * whichever surface renders the provider. The text the learner is typing is
 * not part of it: that draft is one for every chat.
 */
export function ChatProvider({
  chatId,
  children,
}: PropsWithChildren<{ chatId: Id<"chats"> }>) {
  return (
    <ChatConversation chatId={chatId} key={chatId}>
      {children}
    </ChatConversation>
  );
}

/**
 * The state of one chat, which lives and ends with its key: the context its
 * readers use, and the store of what its own actions write.
 */
function ChatConversation({
  chatId,
  children,
}: PropsWithChildren<{ chatId: Id<"chats"> }>) {
  const [store] = useState(createChatStore);
  const value = useChatState(chatId, store);
  return (
    <ChatStoreContext value={store}>
      <ChatContext value={value}>{children}</ChatContext>
    </ChatStoreContext>
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
