"use client";

import { QueryResult, useQuery } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useState } from "react";
import { readChatArgs } from "@/components/ai/chat/access";
import { nextAnswer, shownAnswer } from "@/components/ai/chat/kept";
import { turnOf } from "@/components/ai/chat/turns";
import { useChatTurns } from "@/components/ai/chat/turns.client";
import { useConvexAuth } from "@/components/providers/convex";

/**
 * Reads the authorized facts of one conversation: its chat, its latest turn,
 * and the turns that ended. `turnAt` tells the facts of the turn that answers
 * the prompt at an order, and `turnsLoading` is true until the first page of
 * the turns that ended is there, so the transcript shows no answer without
 * its facts. A reader who is not the owner proves access with the share token
 * of the link. A chat its learner is deleting is not read: the server is about
 * to delete it, and a read that finds it gone fails the page.
 *
 * The last answer stays shown while the read starts again for the same chat:
 * a closed sheet ends its subscriptions, and on reopening the new one has no
 * answer until the server sends it. Without the last answer the composer would
 * close for that moment and drop the files the learner had attached. The kept
 * answer is only shown: `current` stays false until the server answers again,
 * so nothing acts on a turn that may have moved on. A read that is skipped,
 * while the session changes or the chat is being deleted, drops it
 * (`kept.ts`), so the read that follows never shows another learner's chat.
 */
export function useConversation(
  chatId: Id<"chats">,
  shareToken: string | undefined,
  leaving: boolean
) {
  const authenticating = useConvexAuth((auth) => auth.isLoading);
  const skip = authenticating || leaving;
  const result = useQuery(
    nina.conversation.get,
    skip ? "skip" : readChatArgs(chatId, shareToken)
  );
  const ended = useChatTurns(chatId, shareToken, skip);
  const [answered, setAnswered] = useState(result);
  if (QueryResult.isFailure(result)) {
    throw result.error;
  }
  const next = nextAnswer(answered, result);
  if (next !== answered) {
    setAnswered(next);
  }
  const { current, value } = shownAnswer(answered, result);
  const turn = value ? value.turn : null;
  return {
    chat: value ? value.chat : undefined,
    current,
    loadMoreTurns: ended.loadMore,
    turn,
    turnAt: (order: number) => turnOf(turn, ended.ended, order),
    turnsLoading: ended.loading,
    turnsStatus: ended.status,
  };
}
