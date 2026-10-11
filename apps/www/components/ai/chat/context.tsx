"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateTime, Effect, Result } from "effect";
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
import { isChatBusy } from "@/components/ai/chat/busy";
import { draftMessage } from "@/components/ai/chat/messages";
import { useAi } from "@/components/ai/context";
import { NinaConnectionError } from "@/components/ai/feedback";
import { optimisticCancel } from "@/components/ai/optimistic";
import { type NinaDraft, useNinaSubmission } from "@/components/ai/submission";
import { useConvexAuth } from "@/components/providers/convex";
import { useViewer } from "@/lib/identity/client";

/** The failures a stop can end with, besides a lost connection. */
type CancelError = Ref.Error<typeof nina.lifecycle.cancel>;

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
function useChatState(chatId: Id<"chats">) {
  const { chat, turn } = useConversation(chatId);
  const submission = useNinaSubmission();
  const [isPending, startTransition] = useTransition();
  const [cancelling, optimisticallyCancel] = useOptimistic(false);
  const [draft, showDraft] = useOptimistic<NinaMessage | null>(null);
  const [cancelError, setCancelError] = useState<
    CancelError | NinaConnectionError | null
  >(null);
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
  const owner = viewerId !== undefined && chat?.userId === viewerId;
  const canWrite = owner || (viewerId !== undefined && loading && opening);

  // The actions below read this when they run, so they never go stale.
  const snapshot = {
    busy,
    cancelChat,
    chat,
    chatId,
    isPending,
    optimisticallyCancel,
    setCancelError,
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
      now.setCancelError(null);
      const cancelTurn = now.cancelChat.withOptimisticUpdate(
        optimisticCancel(DateTime.toEpochMillis(DateTime.nowUnsafe()))
      );
      now.startTransition(async () => {
        now.optimisticallyCancel(true);
        const cancelled = await Effect.runPromise(
          Effect.tryPromise({
            try: () => cancelTurn({ chatId: now.chatId }),
            catch: () =>
              new NinaConnectionError({
                code: "NINA_CONNECTION_FAILED",
                message: "Nina cancellation could not be confirmed.",
              }),
          }).pipe(Effect.flatMap(Effect.fromResult), Effect.result)
        );
        if (Result.isFailure(cancelled)) {
          now.setCancelError(cancelled.failure);
        }
      });
    },
    /** Sends the same prompt again, or the latest one when no turn is named. */
    retry(order?: number) {
      const now = latest.current;
      const target = order ?? now.turn?.order;
      if (target === undefined || !now.chat || now.busy || now.isPending) {
        return;
      }
      now.startTransition(async () => {
        await now.submission.retry(target, now.chatId);
      });
    },
    send(prompt: NinaDraft) {
      const now = latest.current;
      const chat = now.chat;
      if (!chat || now.busy || now.isPending) {
        return Promise.resolve(false);
      }
      now.setCancelError(null);
      now.setText((previous) =>
        previous.trim() === prompt.text.trim() ? "" : previous
      );
      const admission = now.submission.send(prompt, now.chatId);
      now.startTransition(async () => {
        now.showDraft(
          draftMessage({
            chatId: now.chatId,
            createdAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
            prompt,
            threadId: chat.threadId,
            turnOrder: now.turn?.order,
          })
        );
        const receipt = await admission;
        if (!receipt) {
          now.setText((previous) => previous || prompt.text);
        }
      });
      return admission.then((receipt) => receipt !== undefined);
    },
  }));

  return {
    busy,
    cancel: actions.cancel,
    canWrite,
    chat,
    chatId,
    draft,
    error: submission.error ?? cancelError,
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

/** One reactive conversation shared by the route, sheet and message controls. */
export function ChatProvider({
  chatId,
  children,
}: PropsWithChildren<{ chatId: Id<"chats"> }>) {
  const value = useChatState(chatId);
  return <ChatContext value={value}>{children}</ChatContext>;
}

/** Selects one part of the conversation's state and actions. */
export function useChat<T>(selector: (state: ChatContextValue) => T) {
  const value = use(ChatContext);
  if (!value) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return selector(value);
}
