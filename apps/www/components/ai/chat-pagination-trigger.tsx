"use client";

import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/convex/chats/constants";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { memo } from "react";
import { useCurrentChat } from "@/components/ai/context/use-current-chat";

export const AiChatPaginationTrigger = memo(() => {
  const status = useCurrentChat((state) => state.messageStatus);
  const loadMoreMessages = useCurrentChat((state) => state.loadMoreMessages);

  if (status !== "CanLoadMore") {
    return null;
  }

  return (
    <Intersection
      onIntersect={() => loadMoreMessages(CHAT_MESSAGES_PAGE_SIZE)}
    />
  );
});

AiChatPaginationTrigger.displayName = "AiChatPaginationTrigger";
