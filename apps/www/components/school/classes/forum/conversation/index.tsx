"use client";

import { usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  VirtualConversation,
  type VirtualConversationHandle,
  VirtualConversationPlaceholder,
} from "@repo/design-system/components/ui/virtual-conversation";
import { useTranslations } from "next-intl";
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
import { useForumPosts } from "@/components/school/classes/forum/conversation/use-forum-posts";
import { useMarkRead } from "@/components/school/classes/forum/conversation/use-mark-read";
import { useVirtualItems } from "@/components/school/classes/forum/conversation/use-virtual-items";
import {
  captureConversationView,
  createForumConversationMode,
  createInitialConversationAnchor,
  createInitialConversationView,
  type ForumConversationMode,
} from "@/components/school/classes/forum/conversation/view-state";
import { useForum, useForumStoreApi } from "@/lib/context/use-forum";
import { ForumScrollProvider } from "@/lib/context/use-forum-scroll";
import type { ForumConversationView } from "@/lib/store/forum";

type PendingScrollIntent =
  | {
      kind: "bottom";
    }
  | {
      align: "center" | "start";
      kind: "post";
      offset?: number;
      postId: Id<"schoolClassForumPosts">;
    };

/**
 * Render one forum conversation with explicit live/restore/jump modes and a
 * serializable scroll snapshot model.
 */
export const ForumPostConversation = memo(
  ({
    forum,
    forumId,
    currentUserId,
  }: {
    forum: Forum | undefined;
    forumId: Id<"schoolClassForums">;
    currentUserId: Id<"users">;
  }) => {
    const t = useTranslations("Common");
    const forumStore = useForumStoreApi();
    const saveConversationView = useForum(
      (state) => state.saveConversationView
    );
    const latestConversationView = useRef<ForumConversationView | null>(
      forumStore.getState().savedConversationViews[forumId] ?? null
    );
    const [conversationIntent, setConversationIntent] =
      useState<ForumConversationMode>(() =>
        createForumConversationMode({
          restoreView: latestConversationView.current,
        })
      );
    const [conversationSessionVersion, setConversationSessionVersion] =
      useState(0);
    const initialAnchorSettledRef = useRef(false);
    const pendingScrollIntentRef = useRef<PendingScrollIntent | null>(null);

    const {
      hasMoreAfter,
      hasMoreBefore,
      isInitialLoading,
      isJumpMode,
      isLiveConnected,
      isLoadingNewer,
      isLoadingOlder,
      loadNewerPosts,
      loadOlderPosts,
      posts,
      showLatestPosts,
    } = useForumPosts({ forumId, mode: conversationIntent });

    const { items, postIdToIndex, unreadIndex } = useVirtualItems({
      forum,
      posts,
      isDetachedMode: !isLiveConnected,
    });
    const latestItemsRef = useRef(items);
    latestItemsRef.current = items;
    const initialAnchor = useMemo(
      () =>
        createInitialConversationAnchor({
          existingView: latestConversationView.current,
          mode: conversationIntent,
          postIdToIndex,
          unreadIndex,
        }),
      [conversationIntent, postIdToIndex, unreadIndex]
    );

    const scrollRef = useRef<VirtualConversationHandle>(null);
    const [isPrepending, setIsPrepending] = useState(false);

    const lastPostId = posts.at(-1)?._id;
    const previousLastPostId = usePrevious(lastPostId);
    const { cancelPendingMarkRead, flushMarkRead, scheduleMarkRead } =
      useMarkRead({ forumId });

    /** Captures the current session-restorable viewport into one local ref. */
    const captureCurrentConversationView = useCallback(
      (offset?: number) => {
        const view = captureConversationView({ items, offset, scrollRef });

        if (!view) {
          return null;
        }

        latestConversationView.current = view;
        return view;
      },
      [items]
    );

    /** Saves the latest session-restorable conversation snapshot when needed. */
    const persistConversationView = useCallback(
      (view?: ForumConversationView | null) => {
        const nextView = view ?? latestConversationView.current;

        if (!nextView) {
          return;
        }

        latestConversationView.current = nextView;
        saveConversationView(forumId, nextView);
      },
      [forumId, saveConversationView]
    );

    /** Scrolls to one rendered post in the current virtual list. */
    const scrollToPostId = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const index = postIdToIndex.get(postId);

        if (index === undefined) {
          return;
        }

        scrollRef.current?.scrollToIndex(index, { align: "center" });
      },
      [postIdToIndex]
    );

    /** Opens a post directly or switches the conversation into jump mode. */
    const jumpToPostId = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const index = postIdToIndex.get(postId);
        const nextView = {
          kind: "post",
          offset: 0,
          postId,
        } satisfies ForumConversationView;

        latestConversationView.current = nextView;
        persistConversationView(nextView);

        if (index !== undefined) {
          scrollRef.current?.scrollToIndex(index, { align: "center" });
          return;
        }

        pendingScrollIntentRef.current = {
          kind: "post",
          postId,
          align: "center",
        };
        setConversationIntent({ kind: "jump", postId });
      },
      [persistConversationView, postIdToIndex]
    );

    /** Returns the conversation to the live latest-post edge. */
    const scrollToLatest = useCallback(() => {
      const nextView = { kind: "bottom" } satisfies ForumConversationView;

      latestConversationView.current = nextView;
      persistConversationView(nextView);
      pendingScrollIntentRef.current = { kind: "bottom" };
      setConversationIntent({ kind: "live" });
      showLatestPosts();
    }, [persistConversationView, showLatestPosts]);

    const forumScrollValue = useMemo(
      () => ({ scrollToPostId, jumpToPostId, scrollToLatest }),
      [jumpToPostId, scrollToLatest, scrollToPostId]
    );

    useEffect(() => {
      if (
        initialAnchorSettledRef.current &&
        isLiveConnected &&
        conversationIntent.kind !== "live"
      ) {
        setConversationIntent({ kind: "live" });
      }
    }, [conversationIntent.kind, isLiveConnected]);

    useEffect(() => {
      const pendingScrollIntent = pendingScrollIntentRef.current;

      if (!pendingScrollIntent) {
        return;
      }

      if (pendingScrollIntent.kind === "bottom") {
        if (!isLiveConnected) {
          return;
        }

        requestAnimationFrame(() => {
          scrollRef.current?.scrollToBottom();
        });
        pendingScrollIntentRef.current = null;
        return;
      }

      const index = postIdToIndex.get(pendingScrollIntent.postId);

      if (index === undefined) {
        return;
      }

      requestAnimationFrame(() => {
        scrollRef.current?.scrollToIndex(index, {
          align: pendingScrollIntent.align,
          offset: pendingScrollIntent.offset,
        });
      });
      pendingScrollIntentRef.current = null;
    }, [isLiveConnected, postIdToIndex]);

    /** Marks the thread as read only while the live edge remains visible. */
    const handleScroll = useCallback(
      (offset: number) => {
        if (initialAnchorSettledRef.current) {
          captureCurrentConversationView(offset);
        }

        const atBottom = scrollRef.current?.isAtBottom() ?? true;

        if (!(initialAnchorSettledRef.current && atBottom && isLiveConnected)) {
          cancelPendingMarkRead();
          return;
        }

        scheduleMarkRead(lastPostId);
      },
      [
        cancelPendingMarkRead,
        captureCurrentConversationView,
        isLiveConnected,
        lastPostId,
        scheduleMarkRead,
      ]
    );

    /** Finalizes one fresh-mount anchor before live scroll syncing begins. */
    const handleInitialAnchorSettled = useCallback(() => {
      initialAnchorSettledRef.current = true;

      const initialView =
        captureCurrentConversationView() ??
        createInitialConversationView({
          existingView: latestConversationView.current,
          items,
          mode: conversationIntent,
          unreadIndex,
        });

      if (initialView) {
        latestConversationView.current = initialView;
        persistConversationView(initialView);
      }

      const atBottom =
        scrollRef.current?.isAtBottom() ??
        (initialView ? initialView.kind === "bottom" : false);

      if (!(atBottom && isLiveConnected)) {
        cancelPendingMarkRead();
        return;
      }

      scheduleMarkRead(lastPostId);
    }, [
      cancelPendingMarkRead,
      captureCurrentConversationView,
      conversationIntent,
      isLiveConnected,
      items,
      lastPostId,
      persistConversationView,
      scheduleMarkRead,
      unreadIndex,
    ]);

    /** Saves the latest fallback snapshot when scrolling settles or the route hides. */
    const handleScrollEnd = useCallback(() => {
      if (!initialAnchorSettledRef.current) {
        return;
      }

      persistConversationView(captureCurrentConversationView());
    }, [captureCurrentConversationView, persistConversationView]);

    /**
     * Next Activity preserves refs across soft-nav hide/show cycles. Reset the
     * transient conversation session on hide so explicit reopen restores from
     * the saved snapshot instead of stale preserved controller state.
     */
    useLayoutEffect(
      () => () => {
        const latestView = captureConversationView({
          items: latestItemsRef.current,
          scrollRef,
        });

        if (latestView) {
          latestConversationView.current = latestView;
          persistConversationView(latestView);
        } else {
          persistConversationView();
        }

        pendingScrollIntentRef.current = null;
        initialAnchorSettledRef.current = false;
        setIsPrepending(false);
        setConversationIntent(
          createForumConversationMode({
            restoreView: latestConversationView.current,
          })
        );
        setConversationSessionVersion((version) => version + 1);
      },
      [persistConversationView]
    );

    useEffect(() => {
      if (
        !(
          initialAnchorSettledRef.current &&
          isLiveConnected &&
          lastPostId &&
          previousLastPostId
        )
      ) {
        return;
      }

      if (lastPostId === previousLastPostId) {
        return;
      }

      if (!(scrollRef.current?.isAtBottom() ?? true)) {
        return;
      }

      flushMarkRead(lastPostId);
    }, [flushMarkRead, isLiveConnected, lastPostId, previousLastPostId]);

    /** Loads newer history below the current transcript window. */
    const handleScrollToBottom = useCallback(() => {
      if (hasMoreAfter && !isLoadingNewer) {
        loadNewerPosts();
      }
    }, [hasMoreAfter, isLoadingNewer, loadNewerPosts]);

    /** Loads older items above the current transcript window when needed. */
    const handleScrollToTop = useCallback(() => {
      if (hasMoreBefore && !isLoadingOlder) {
        setIsPrepending(true);
        loadOlderPosts();
      }
    }, [hasMoreBefore, isLoadingOlder, loadOlderPosts]);

    useEffect(() => {
      if (isPrepending && !isLoadingOlder) {
        setIsPrepending(false);
      }
    }, [isLoadingOlder, isPrepending]);

    if (isInitialLoading || !forum) {
      return <VirtualConversationPlaceholder />;
    }

    return (
      <ForumScrollProvider value={forumScrollValue}>
        <div className="relative flex size-full flex-col overflow-hidden">
          <VirtualConversation
            floatingContent={
              <Activity mode={isJumpMode ? "visible" : "hidden"}>
                <JumpModeIndicator onExit={scrollToLatest} />
              </Activity>
            }
            followLatest={isLiveConnected}
            hideScrollButton={isJumpMode}
            initialAnchor={initialAnchor}
            key={conversationSessionVersion}
            onInitialAnchorSettled={handleInitialAnchorSettled}
            onScroll={handleScroll}
            onScrollEnd={handleScrollEnd}
            onScrollToBottom={handleScrollToBottom}
            onScrollToTop={handleScrollToTop}
            scrollButtonAction={scrollToLatest}
            scrollButtonAriaLabel={t("back-to-latest")}
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
                return <div className="h-12" key="spacer" />;
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
          <ForumPostInput forumId={forumId} />
        </div>
      </ForumScrollProvider>
    );
  }
);
ForumPostConversation.displayName = "ForumPostConversation";
