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
  resolveScrollCommand,
  type ScrollCommand,
  shouldPersistBottomConversationView,
} from "@/components/school/classes/forum/conversation/scroll-command";
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
    const initialAnchorSettledRef = useRef(false);
    const nextScrollCommandIdRef = useRef(0);
    const pendingBottomPersistenceIdRef = useRef<number | null>(null);
    const [scrollCommand, setScrollCommand] = useState<ScrollCommand | null>(
      null
    );

    const {
      hasMoreAfter,
      hasMoreBefore,
      isAtLatestEdge,
      isInitialLoading,
      isJumpMode,
      isLoadingNewer,
      isLoadingOlder,
      loadNewerPosts,
      loadOlderPosts,
      posts,
      showLatestPosts,
    } = useForumPosts({ forumId, mode: conversationIntent });
    const baselineLatestPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
      null
    );

    if (
      baselineLatestPostIdRef.current === null &&
      isAtLatestEdge &&
      posts.length > 0
    ) {
      baselineLatestPostIdRef.current = posts.at(-1)?._id ?? null;
    }

    const { dateToIndex, headerIndex, items, postIdToIndex, unreadIndex } =
      useVirtualItems({
        baselineLatestPostId: baselineLatestPostIdRef.current,
        forum,
        posts,
        isDetachedMode: !isAtLatestEdge,
      });
    const latestItemsRef = useRef(items);
    latestItemsRef.current = items;
    const initialAnchor = useMemo(
      () =>
        createInitialConversationAnchor({
          dateToIndex,
          existingView: latestConversationView.current,
          headerIndex,
          mode: conversationIntent,
          postIdToIndex,
          unreadIndex,
        }),
      [conversationIntent, dateToIndex, headerIndex, postIdToIndex, unreadIndex]
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

    /** Commits a confirmed latest-edge landing into the persisted view store. */
    const persistBottomConversationView = useCallback(() => {
      const bottomView = { kind: "bottom" } satisfies ForumConversationView;

      pendingBottomPersistenceIdRef.current = null;
      latestConversationView.current = bottomView;
      persistConversationView(bottomView);
    }, [persistConversationView]);

    /** Persists a latest-edge command only after the viewport actually reaches bottom. */
    const maybePersistBottomConversationView = useCallback(
      (atBottom: boolean) => {
        if (
          !shouldPersistBottomConversationView({
            hasPendingBottomPersistence:
              pendingBottomPersistenceIdRef.current !== null,
            isAtBottom: atBottom,
            isAtLatestEdge,
            isInitialAnchorSettled: initialAnchorSettledRef.current,
          })
        ) {
          return false;
        }

        persistBottomConversationView();
        return true;
      },
      [isAtLatestEdge, persistBottomConversationView]
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

        pendingBottomPersistenceIdRef.current = null;
        nextScrollCommandIdRef.current += 1;
        setScrollCommand({
          align: "center",
          id: nextScrollCommandIdRef.current,
          kind: "post",
          postId,
        });

        if (index !== undefined) {
          return;
        }

        setConversationIntent({ kind: "jump", postId });
      },
      [persistConversationView, postIdToIndex]
    );

    /** Returns the conversation to the live latest-post edge. */
    const scrollToLatest = useCallback(() => {
      pendingBottomPersistenceIdRef.current = null;
      nextScrollCommandIdRef.current += 1;
      setScrollCommand({ id: nextScrollCommandIdRef.current, kind: "bottom" });
      setConversationIntent({ kind: "live" });
      showLatestPosts();
    }, [showLatestPosts]);

    const forumScrollValue = useMemo(
      () => ({ scrollToPostId, jumpToPostId, scrollToLatest }),
      [jumpToPostId, scrollToLatest, scrollToPostId]
    );

    useEffect(() => {
      if (
        initialAnchorSettledRef.current &&
        isAtLatestEdge &&
        conversationIntent.kind !== "live"
      ) {
        setConversationIntent({ kind: "live" });
      }
    }, [conversationIntent.kind, isAtLatestEdge]);

    useLayoutEffect(() => {
      const resolvedScrollCommand = resolveScrollCommand({
        command: scrollCommand,
        isAtLatestEdge,
        postIdToIndex,
      });

      if (!resolvedScrollCommand) {
        return;
      }

      if (resolvedScrollCommand.kind === "bottom") {
        pendingBottomPersistenceIdRef.current = resolvedScrollCommand.commandId;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToBottom();
        });
        setScrollCommand(null);
        return;
      }

      requestAnimationFrame(() => {
        scrollRef.current?.scrollToIndex(resolvedScrollCommand.index, {
          align: resolvedScrollCommand.align,
          offset: resolvedScrollCommand.offset,
        });
      });
      setScrollCommand(null);
    }, [isAtLatestEdge, postIdToIndex, scrollCommand]);

    /** Marks the thread as read only while the live edge remains visible. */
    const handleScroll = useCallback(
      (offset: number) => {
        if (initialAnchorSettledRef.current) {
          captureCurrentConversationView(offset);
        }

        const atBottom = scrollRef.current?.isAtBottom() ?? true;
        maybePersistBottomConversationView(atBottom);

        if (!(initialAnchorSettledRef.current && atBottom && isAtLatestEdge)) {
          cancelPendingMarkRead();
          return;
        }

        scheduleMarkRead(lastPostId);
      },
      [
        cancelPendingMarkRead,
        captureCurrentConversationView,
        isAtLatestEdge,
        lastPostId,
        maybePersistBottomConversationView,
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

      if (!(atBottom && isAtLatestEdge)) {
        cancelPendingMarkRead();
        return;
      }

      scheduleMarkRead(lastPostId);
    }, [
      cancelPendingMarkRead,
      captureCurrentConversationView,
      conversationIntent,
      isAtLatestEdge,
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

      if (
        maybePersistBottomConversationView(
          scrollRef.current?.isAtBottom() ?? false
        )
      ) {
        return;
      }

      persistConversationView(captureCurrentConversationView());
    }, [
      captureCurrentConversationView,
      maybePersistBottomConversationView,
      persistConversationView,
    ]);

    /** Persists the latest fallback snapshot when the conversation hides. */
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

        pendingBottomPersistenceIdRef.current = null;
        setScrollCommand(null);
      },
      [persistConversationView]
    );

    useEffect(() => {
      if (
        !(
          initialAnchorSettledRef.current &&
          isAtLatestEdge &&
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
    }, [flushMarkRead, isAtLatestEdge, lastPostId, previousLastPostId]);

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
            followLatest={isAtLatestEdge}
            hideScrollButton={isJumpMode}
            initialAnchor={initialAnchor}
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
