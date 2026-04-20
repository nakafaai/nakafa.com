"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { memo } from "react";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { useTranscriptLifecycle } from "@/components/school/classes/forum/conversation/hooks/transcript/use-lifecycle";
import { useTranscriptVirtualizer } from "@/components/school/classes/forum/conversation/hooks/transcript/use-virtualizer";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";
import {
  DateSeparator,
  UnreadSeparator,
} from "@/components/school/classes/forum/conversation/separators";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";

/** Renders one local TanStack-first transcript with feature-owned scroll policy. */
export function ForumConversationTranscript() {
  const command = useConversation((value) => value.state.command);
  const hasMoreAfter = useConversation((value) => value.state.hasMoreAfter);
  const hasMoreBefore = useConversation((value) => value.state.hasMoreBefore);
  const highlightedPostId = useConversation(
    (value) => value.state.highlightedPostId
  );
  const isAtLatestEdge = useConversation((value) => value.state.isAtLatestEdge);
  const isLoadingNewer = useConversation((value) => value.state.isLoadingNewer);
  const isLoadingOlder = useConversation((value) => value.state.isLoadingOlder);
  const items = useConversation((value) => value.state.items);
  const lastPostId = useConversation((value) => value.state.lastPostId);
  const latestConversationView = useConversation(
    (value) => value.state.latestConversationView
  );
  const mode = useConversation((value) => value.state.mode);
  const pendingHighlightPostId = useConversation(
    (value) => value.state.pendingHighlightPostId
  );
  const postIdToIndex = useConversation((value) => value.state.postIdToIndex);
  const timelineSessionVersion = useConversation(
    (value) => value.state.timelineSessionVersion
  );
  const unreadPostId = useConversation((value) => value.state.unreadPostId);
  const cancelPendingMarkRead = useConversation(
    (value) => value.actions.cancelPendingMarkRead
  );
  const flushMarkRead = useConversation((value) => value.actions.flushMarkRead);
  const handleBottomStateChange = useConversation(
    (value) => value.actions.handleBottomStateChange
  );
  const handleCommandResult = useConversation(
    (value) => value.actions.handleCommandResult
  );
  const handleHighlightVisiblePost = useConversation(
    (value) => value.actions.handleHighlightVisiblePost
  );
  const handleSettledView = useConversation(
    (value) => value.actions.handleSettledView
  );
  const loadNewerPosts = useConversation(
    (value) => value.actions.loadNewerPosts
  );
  const loadOlderPosts = useConversation(
    (value) => value.actions.loadOlderPosts
  );
  const scheduleMarkRead = useConversation(
    (value) => value.actions.scheduleMarkRead
  );

  const {
    measureElement,
    runtime,
    scrollElementRef,
    totalSize,
    translateY,
    virtualItems,
  } = useTranscriptVirtualizer({
    cancelPendingMarkRead,
    handleBottomStateChange,
    handleHighlightVisiblePost,
    handleSettledView,
    hasMoreAfter,
    hasMoreBefore,
    isAtLatestEdge,
    isLoadingNewer,
    isLoadingOlder,
    highlightedPostId,
    items,
    lastPostId,
    latestConversationView,
    loadNewerPosts,
    loadOlderPosts,
    pendingHighlightPostId,
    postIdToIndex,
    scheduleMarkRead,
  });

  useTranscriptLifecycle({
    cancelPendingMarkRead,
    command,
    flushMarkRead,
    handleCommandResult,
    isAtLatestEdge,
    isLoadingOlder,
    items,
    lastPostId,
    latestConversationView,
    mode,
    runtime,
    timelineSessionVersion,
    unreadPostId,
  });

  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      data-testid="virtual-conversation"
      ref={scrollElementRef}
    >
      <div className="relative w-full" style={{ height: `${totalSize}px` }}>
        <div
          className="w-full"
          style={{ transform: `translateY(${translateY}px)` }}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];

            if (!item) {
              return null;
            }

            return (
              <div
                className="flow-root w-full"
                data-index={virtualItem.index}
                key={virtualItem.key}
                ref={measureElement}
              >
                <TranscriptRow
                  highlightedPostId={highlightedPostId}
                  item={item}
                />
              </div>
            );
          })}
        </div>
      </div>
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

/** Renders one semantic transcript row inside the mounted virtual window. */
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
      <ForumPostItem
        isFirstInGroup={item.isFirstInGroup}
        isJumpHighlighted={highlightedPostId === item.post._id}
        isLastInGroup={item.isLastInGroup}
        post={item.post}
        showContinuationTime={item.showContinuationTime}
      />
    );
  }
);
TranscriptRow.displayName = "TranscriptRow";
