"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  VirtualConversation,
  type VirtualConversationHandle,
  VirtualConversationPlaceholder,
} from "@repo/design-system/components/ui/virtual-conversation";
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import {
  DateSeparator,
  JumpModeIndicator,
  UnreadSeparator,
} from "@/components/school/classes/forum/conversation/separators";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { useAutoScroll } from "@/components/school/classes/forum/conversation/use-auto-scroll";
import { useForumPosts } from "@/components/school/classes/forum/conversation/use-forum-posts";
import { useMarkRead } from "@/components/school/classes/forum/conversation/use-mark-read";
import { useVirtualItems } from "@/components/school/classes/forum/conversation/use-virtual-items";
import { useForum } from "@/lib/context/use-forum";
import { ForumScrollProvider } from "@/lib/context/use-forum-scroll";

export const ForumPostConversation = memo(
  ({
    forum,
    lastReadAt,
    currentUserId,
  }: {
    forum: Forum;
    lastReadAt: number;
    currentUserId: Id<"users">;
  }) => {
    // Data fetching & pagination
    const {
      posts,
      isJumpMode,
      targetIndex,
      hasMoreBefore,
      hasMoreAfter,
      isLoadingOlder,
      isLoadingNewer,
      isInitialLoading,
      status,
      loadMore,
      loadOlderPosts,
      loadNewerPosts,
      exitJumpMode,
    } = useForumPosts(forum._id);

    // Virtual list items
    const { items, initialScrollIndex, postIdToIndex } = useVirtualItems({
      forum,
      posts,
      currentUserId,
      lastReadAt,
      isJumpMode,
      targetIndex,
    });

    // Scroll refs and state
    const scrollRef = useRef<VirtualConversationHandle>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isPrepending, setIsPrepending] = useState(false);

    // Mark read strategy - use lastPostTime to detect new posts (not pagination)
    const lastPostTime = posts.at(-1)?._creationTime;
    useMarkRead({
      forumId: forum._id,
      lastPostTime,
      isAtBottom,
      isJumpMode,
    });

    // Auto-scroll on new messages
    useAutoScroll({
      postsLength: posts.length,
      isJumpMode,
      scrollRef,
    });

    // Scroll callbacks
    const scrollToPostId = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const index = postIdToIndex.get(postId);
        if (index !== undefined) {
          scrollRef.current?.scrollToIndex(index);
        }
      },
      [postIdToIndex]
    );

    const enterJumpMode = useForum((s) => s.enterJumpMode);
    const jumpToPostId = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const index = postIdToIndex.get(postId);
        if (index !== undefined) {
          scrollRef.current?.scrollToIndex(index);
        } else {
          enterJumpMode(postId);
        }
      },
      [postIdToIndex, enterJumpMode]
    );

    const scrollToBottom = useCallback(() => {
      scrollRef.current?.scrollToBottom();
    }, []);

    // Handlers
    const handleScroll = useCallback(() => {
      const atBottom = scrollRef.current?.isAtBottom() ?? true;
      setIsAtBottom(atBottom);
    }, []);

    const handleScrollToBottom = useCallback(() => {
      if (isJumpMode) {
        if (hasMoreAfter && !isLoadingNewer) {
          loadNewerPosts();
        } else if (!hasMoreAfter) {
          exitJumpMode();
        }
      }
    }, [
      isJumpMode,
      hasMoreAfter,
      isLoadingNewer,
      loadNewerPosts,
      exitJumpMode,
    ]);

    const handleScrollToTop = useCallback(() => {
      if (isJumpMode && hasMoreBefore && !isLoadingOlder) {
        loadOlderPosts();
      } else if (!isJumpMode && status === "CanLoadMore") {
        setIsPrepending(true);
        loadMore(25);
      }
    }, [
      isJumpMode,
      hasMoreBefore,
      isLoadingOlder,
      loadOlderPosts,
      status,
      loadMore,
    ]);

    // Reset isPrepending when loading completes
    useEffect(() => {
      if (isPrepending && status !== "LoadingMore") {
        setIsPrepending(false);
      }
    }, [isPrepending, status]);

    if (isInitialLoading) {
      return <VirtualConversationPlaceholder />;
    }

    return (
      <ForumScrollProvider
        value={{ scrollToPostId, jumpToPostId, scrollToBottom }}
      >
        <div className="relative flex size-full flex-col overflow-hidden">
          <VirtualConversation
            floatingContent={
              <Activity mode={isJumpMode ? "visible" : "hidden"}>
                <JumpModeIndicator onExit={exitJumpMode} />
              </Activity>
            }
            hideScrollButton={isJumpMode}
            initialScroll={initialScrollIndex}
            onScroll={handleScroll}
            onScrollToBottom={handleScrollToBottom}
            onScrollToTop={handleScrollToTop}
            scrollRef={scrollRef}
            shift={isPrepending}
          >
            {items.map((item) => {
              if (item.type === "header") {
                return <ForumHeader forum={item.forum} key="header" />;
              }

              if (item.type === "date") {
                return (
                  <DateSeparator date={item.date} key={`date-${item.date}`} />
                );
              }

              if (item.type === "unread") {
                return <UnreadSeparator count={item.count} key="unread" />;
              }

              if (item.type === "spacer") {
                return <div className="h-4" key="spacer" />;
              }

              return (
                <ForumPostItem
                  currentUserId={currentUserId}
                  isFirstInGroup={item.isFirstInGroup}
                  key={item.post._id}
                  post={item.post}
                />
              );
            })}
          </VirtualConversation>
          <ForumPostInput forumId={forum._id} />
        </div>
      </ForumScrollProvider>
    );
  }
);
ForumPostConversation.displayName = "ForumPostConversation";
