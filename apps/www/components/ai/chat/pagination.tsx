"use client";

import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/confect/nina/presentation.spec";
import { Intersection } from "@repo/design-system/components/ui/intersection";

import { useChat } from "@/components/ai/chat/context";

export function AiChatPaginationTrigger() {
  const pagination = useChat((state) => state.pagination);

  if (pagination.status !== "CanLoadMore") {
    return null;
  }

  return (
    <Intersection
      onIntersect={() => pagination.loadMore(NINA_MESSAGES_PAGE_SIZE)}
    />
  );
}

AiChatPaginationTrigger.displayName = "AiChatPaginationTrigger";
