"use client";

import { Intersection } from "@repo/design-system/components/ui/intersection";

import { useChat } from "@/components/ai/chat/context";

export function AiChatPaginationTrigger() {
  const canLoadMore = useChat((state) => state.canLoadMore);
  const loadMore = useChat((state) => state.loadMore);

  if (!canLoadMore) {
    return null;
  }

  return <Intersection onIntersect={loadMore} />;
}

AiChatPaginationTrigger.displayName = "AiChatPaginationTrigger";
