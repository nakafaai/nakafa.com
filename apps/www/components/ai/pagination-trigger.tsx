"use client";

import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/confect/chats/constants";
import { Intersection } from "@repo/design-system/components/ui/intersection";

import { useChat } from "@/components/ai/context/use-chat";

export function AiChatPaginationTrigger() {
  const pagination = useChat((state) => state.pagination);

  if (pagination.status !== "CanLoadMore") {
    return null;
  }

  return (
    <Intersection
      onIntersect={() => pagination.loadMore(CHAT_MESSAGES_PAGE_SIZE)}
    />
  );
}

AiChatPaginationTrigger.displayName = "AiChatPaginationTrigger";
