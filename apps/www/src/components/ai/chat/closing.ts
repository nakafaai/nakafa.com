"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMemo } from "react";
import { readChatArgs } from "@/components/ai/chat/access";
import { turnsByOrder } from "@/components/ai/chat/turns";

/**
 * The turns of a conversation that ended, which the messages of its transcript
 * do not carry. They load beside the first page of messages, and a page of them
 * is as many as a page of messages holds, so the turns of the messages that
 * show are among them. `loadMore` loads the next page, with the next page of
 * messages. The turn that runs is not among them: the conversation tells it.
 * A reader proves access with the share token of the link.
 */
export function useChatTurns(
  chatId: Id<"chats">,
  shareToken: string | undefined,
  skip: boolean
) {
  const pagination = usePaginatedQuery(
    nina.conversation.turns,
    skip ? "skip" : readChatArgs(chatId, shareToken),
    { initialNumItems: NINA_MESSAGES_PAGE_SIZE }
  );
  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  const ended = useMemo(
    () => turnsByOrder(pagination.results),
    [pagination.results]
  );
  return {
    ended,
    loadMore: PaginatedQueryResult.isCanLoadMore(pagination)
      ? () => pagination.loadMore(NINA_MESSAGES_PAGE_SIZE)
      : undefined,
    loading: PaginatedQueryResult.isLoadingFirstPage(pagination),
    status: pagination._tag,
  };
}
