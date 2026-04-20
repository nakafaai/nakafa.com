"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { memo } from "react";
import { Virtualizer } from "virtua";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { useTranscript } from "@/components/school/classes/forum/conversation/hooks/transcript/use-transcript";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import {
  DateSeparator,
  UnreadSeparator,
} from "@/components/school/classes/forum/conversation/separators";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import { FORUM_VIRTUAL_BUFFER_SIZE } from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import { getConversationItemKey } from "@/components/school/classes/forum/conversation/utils/transcript";

/** Renders the forum transcript with feature-local Virtua ownership. */
export function ForumConversationTranscript() {
  const {
    handleRef,
    handleScroll,
    handleScrollEnd,
    highlightedPostId,
    items,
    scrollElementRef,
    setScrollElementRef,
    shift,
  } = useTranscript();

  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      data-testid="virtual-conversation"
      ref={setScrollElementRef}
      style={{ overflowAnchor: "none" }}
    >
      <Virtualizer
        bufferSize={FORUM_VIRTUAL_BUFFER_SIZE}
        data={items}
        onScroll={handleScroll}
        onScrollEnd={handleScrollEnd}
        ref={handleRef}
        scrollRef={scrollElementRef}
        shift={shift}
      >
        {(item) => (
          <TranscriptRow
            highlightedPostId={highlightedPostId}
            item={item}
            key={getConversationItemKey(item)}
          />
        )}
      </Virtualizer>
    </div>
  );
}
ForumConversationTranscript.displayName = "ForumConversationTranscript";

/** Renders the local forum transcript placeholder while the first timeline is loading. */
export const ForumConversationTranscriptPlaceholder = memo(() => (
  <div
    className="flex min-h-0 flex-1 items-center justify-center"
    data-testid="virtual-conversation-placeholder"
  >
    <Spinner className="text-muted-foreground" />
  </div>
));
ForumConversationTranscriptPlaceholder.displayName =
  "ForumConversationTranscriptPlaceholder";

/** Renders one semantic transcript row inside one measured Virtua item. */
const TranscriptRow = memo(
  ({
    highlightedPostId,
    item,
  }: {
    highlightedPostId: Id<"schoolClassForumPosts"> | null;
    item: VirtualItem;
  }) => {
    if (item.type === "header") {
      return <ForumHeader forum={item.forum} />;
    }

    if (item.type === "date") {
      return <DateSeparator date={item.date} />;
    }

    if (item.type === "unread") {
      return <UnreadSeparator count={item.count} status={item.status} />;
    }

    return (
      <div
        className={cn(
          "flow-root w-full",
          item.isFirstInGroup && "pt-3",
          item.isLastInGroup && "pb-3"
        )}
        data-post-id={item.post._id}
      >
        <ForumPostItem
          isFirstInGroup={item.isFirstInGroup}
          isJumpHighlighted={highlightedPostId === item.post._id}
          post={item.post}
          showContinuationTime={item.showContinuationTime}
        />
      </div>
    );
  }
);
TranscriptRow.displayName = "TranscriptRow";
