import { useMutation } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateTime, Effect, Fiber } from "effect";
import {
  createContext,
  type PropsWithChildren,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useStore } from "zustand";
import { readChatAccess } from "@/components/ai/chat/access";
import { isChatBusy } from "@/components/ai/chat/busy";
import { optimisticCancel } from "@/components/ai/chat/cancel";
import { useConversation } from "@/components/ai/chat/conversation";
import { draftMessage } from "@/components/ai/chat/messages";
import {
  type ChatStoreApi,
  ChatStoreContext,
  createChatStore,
} from "@/components/ai/chat/store";
import { useAi } from "@/components/ai/context";
import { NinaConnectionError } from "@/components/ai/feedback";
import { restoreRefusedText } from "@/components/ai/store/draft";
import { type NinaDraft, useNinaSubmission } from "@/components/ai/submission";
import { useAuthSessionStore } from "@/components/auth/session";
import { useViewer } from "@/lib/identity/client";

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Provides one conversation's state and actions, with the store of its
 * controls, to the controls below it. A learner's chat builds them from the live
 * conversation (`ChatProvider`), and a reader's chat from the server's read, so
 * every message control reads one shape.
 */
export function ChatValueProvider({
  children,
  store,
  value,
}: PropsWithChildren<{ store: ChatStoreApi; value: ChatContextValue }>) {
  return (
    <ChatStoreContext value={store}>
      <ChatContext value={value}>{children}</ChatContext>
    </ChatStoreContext>
  );
}

/**
 * Owns one conversation's state and actions. It never reads the streamed
 * messages, which only the transcript does, so it does not render while text
 * streams. Each action is one function for the life of the provider and
 * reads the latest render when it runs.
 */
function useChatState(
  chatId: Id<"chats">,
  shareToken: string | undefined,
  store: ChatStoreApi
) {
  const leaving = useStore(store, (state) => state.leaving);
  const {
    chat,
    current,
    loadMoreTurns,
    turn,
    turnAt,
    turnsLoading,
    turnsStatus,
  } = useConversation(chatId, shareToken, leaving);
  const submission = useNinaSubmission(store.getState().setSubmissionFailure);
  const session = useAuthSessionStore();
  // A send, stop or retry on its way is held by the chat store as plain state. A
  // transition would hold it until the server answers, and React makes every
  // transition started meanwhile wait for a pending one: the learner's next
  // navigation would wait for the answer too.
  const isPending = useStore(store, (state) => state.isPending);
  const cancelling = useStore(store, (state) => state.cancelling);
  const draft = useStore(store, (state) => state.draft);
  const setText = useAi((state) => state.setText);
  const opening = useAi(
    (state) => state.openingChat?.receipt.chatId === chatId
  );
  const viewerId = useViewer((state) => state.viewer?.id);
  const cancelChat = useMutation(nina.lifecycle.cancel);

  const loading = !current;
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
    loading,
    setText,
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
      if (now.isPending || now.loading) {
        return;
      }
      const { setCancelling, setPending, setStopFailure } = store.getState();
      setStopFailure(null);
      const stoppedOrder = now.turn?.order;
      const cancelTurn = now.cancelChat.withOptimisticUpdate(
        optimisticCancel(DateTime.toEpochMillis(DateTime.nowUnsafe()))
      );
      // The stop holds `cancelling` and `isPending` until the server answers, so
      // the turn shows as cancelled at once. Convex applies the optimistic
      // update when the stop starts, and no transition holds the navigation.
      const stopping = Effect.tryPromise({
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
            Effect.sync(() => setStopFailure({ failure, order: stoppedOrder })),
          onSuccess: () => Effect.void,
        }),
        Effect.ensuring(
          Effect.sync(() => {
            setCancelling(false);
            setPending(false);
          })
        )
      );
      setCancelling(true);
      setPending(true);
      Effect.runFork(stopping);
    },
    /** Sends the same prompt again, or the latest one when no turn is named. */
    retry(order?: number) {
      const now = latest.current;
      const { setPending } = store.getState();
      const target = order ?? now.turn?.order;
      if (
        target === undefined ||
        !now.chat ||
        now.busy ||
        now.isPending ||
        now.loading
      ) {
        return;
      }
      // The retry holds `isPending` until it settles, for the same reason as a stop.
      const retrying = now.submission.retry(target, now.chatId);
      setPending(true);
      Effect.runFork(
        Effect.promise(() => retrying).pipe(
          Effect.ensuring(Effect.sync(() => setPending(false)))
        )
      );
    },
    /**
     * Sends a prompt. The send starts at once and its one outcome has two
     * readers: the optimistic prompt, which shows until the admission settles,
     * and the composer, which keeps the learner's text and files until it knows
     * the prompt was admitted. A prompt that was not admitted returns to the
     * composer ahead of anything the learner has typed since, and only to the
     * learner who sent it. The text is one draft for every chat, so a prompt
     * that fails after the learner opened another chat returns to the composer
     * open then, and its files stay with the composer they were added in.
     */
    send(prompt: NinaDraft) {
      const now = latest.current;
      const chat = now.chat;
      if (!chat || now.busy || now.isPending || now.loading) {
        return false;
      }
      const { setDraft, setPending } = store.getState();
      const sentBy = session.getState().userId;
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
                  now.setText((typed) =>
                    restoreRefusedText({
                      refused: prompt.text,
                      sentBy,
                      signedInAs: session.getState().userId,
                      typed,
                    })
                  )
                )
          )
        )
      );
      setPending(true);
      setDraft(
        draftMessage({
          chatId: now.chatId,
          createdAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
          prompt,
          threadId: chat.threadId,
          turnOrder: now.turn?.order,
        })
      );
      return Effect.runPromise(
        Fiber.join(admission).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              setDraft(null);
              setPending(false);
            })
          )
        )
      );
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
    loadMoreTurns,
    owner,
    retry: actions.retry,
    send: actions.send,
    shareToken,
    turn,
    turnAt,
    turnsLoading,
    turnsStatus,
  };
}

/**
 * The conversation's state and actions. It changes when a turn starts, ends
 * or fails, never with a streamed token, so the controls that read it stay
 * still while Nina writes.
 */
export type ChatContextValue = ReturnType<typeof useChatState>;

/**
 * One reactive conversation shared by the route, sheet and message controls.
 * Each chat gets its own state and its own subtree, so choosing another chat
 * starts with none of the previous chat's error, stop, send or pending prompt,
 * whichever surface renders the provider. The caller gives the provider a key
 * of the chat's id: the state of one chat lives and ends with that key. The text
 * the learner is typing is not part of it: that draft is one for every chat.
 * `shareToken` is the one a shared link carries, for a reader who is not the
 * owner.
 */
export function ChatProvider({
  chatId,
  children,
  shareToken,
}: PropsWithChildren<{
  chatId: Id<"chats">;
  shareToken?: string | undefined;
}>) {
  const [store] = useState(createChatStore);
  const value = useChatState(chatId, shareToken, store);
  return (
    <ChatValueProvider store={store} value={value}>
      {children}
    </ChatValueProvider>
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
