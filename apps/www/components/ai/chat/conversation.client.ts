"use client";

import { QueryResult, useQuery } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { readChatArgs } from "@/components/ai/chat/access";
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
  if (QueryResult.isFailure(result)) {
    throw result.error;
  }
  const turn = QueryResult.isSuccess(result) ? result.value.turn : null;
  return {
    chat: QueryResult.isSuccess(result) ? result.value.chat : undefined,
    loadMoreTurns: ended.loadMore,
    turn,
    turnAt: (order: number) => turnOf(turn, ended.ended, order),
    turnsLoading: ended.loading,
    turnsStatus: ended.status,
  };
}
