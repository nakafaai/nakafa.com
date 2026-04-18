"use client";

import { usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  VirtualConversation,
  type VirtualConversationAnchor,
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
  createPendingPostTarget,
  type PendingPostTarget,
  resolvePendingPostTargetProgress,
} from "@/components/school/classes/forum/conversation/post-target";
import {
  resolveScrollCommand,
  type ScrollCommand,
  shouldPersistBottomConversationView,
} from "@/components/school/classes/forum/conversation/scroll-command";
import { getForumPrefetchDistance } from "@/components/school/classes/forum/conversation/scroll-policy";
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

const FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD = 50;

/** Returns whether the live transcript is close enough to bottom for read-state UX. */
function isNearForumReadStateBottom(
  handle: VirtualConversationHandle | null | undefined
) {
  if (!handle) {
    return false;
  }

  return (
    handle.isAtBottom() ||
    handle.getDistanceFromBottom() <= FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD
  );
}

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
    const persistBottomOnArrivalRef = useRef(false);
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
      timelineSessionVersion,
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

    const [hasPendingPostTarget, setHasPendingPostTarget] = useState(false);
    const pendingPostTargetRef = useRef<PendingPostTarget | null>(null);
    const pendingLatestSessionRef = useRef(false);
    const previousTimelineSessionVersionRef = useRef(timelineSessionVersion);

    const scrollRef = useRef<VirtualConversationHandle>(null);
    const [isPrepending, setIsPrepending] = useState(false);
    const previousScrollOffsetRef = useRef(0);
    const wasInBottomPrefetchZoneRef = useRef(false);
    const wasInTopPrefetchZoneRef = useRef(false);

    /** Resets transient scroll refs whenever one semantic transcript session remounts. */
    function resetTimelineSessionState() {
      initialAnchorSettledRef.current = false;
      persistBottomOnArrivalRef.current = pendingLatestSessionRef.current;
      previousScrollOffsetRef.current = 0;
      wasInTopPrefetchZoneRef.current = false;
      wasInBottomPrefetchZoneRef.current = false;
    }

    if (previousTimelineSessionVersionRef.current !== timelineSessionVersion) {
      previousTimelineSessionVersionRef.current = timelineSessionVersion;
      resetTimelineSessionState();
    }

    /** Resolves the fresh-mount anchor for the current transcript session. */
    const initialAnchor: VirtualConversationAnchor =
      pendingLatestSessionRef.current
        ? { kind: "bottom" }
        : createInitialConversationAnchor({
            dateToIndex,
            existingView: latestConversationView.current,
            headerIndex,
            mode: conversationIntent,
            postIdToIndex,
            unreadIndex,
          });

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

    /** Registers one post target that must visibly land before settling the conversation. */
    const registerPendingPostTarget = useCallback(
      (pendingPostTarget: PendingPostTarget) => {
        pendingPostTargetRef.current = pendingPostTarget;
        setHasPendingPostTarget(true);
      },
      []
    );

    /** Clears the current pending post target after it lands or the flow changes. */
    const clearPendingPostTarget = useCallback(() => {
      if (!pendingPostTargetRef.current) {
        return;
      }

      pendingPostTargetRef.current = null;
      setHasPendingPostTarget(false);
    }, []);

    /** Ensures the current pending post target is visible before the conversation can settle. */
    const settlePendingPostTarget = useCallback(() => {
      const progress = resolvePendingPostTargetProgress({
        handle: scrollRef.current,
        pendingPostTarget: pendingPostTargetRef.current,
        postIdToIndex,
      });

      if (progress.kind === "idle") {
        return true;
      }

      if (progress.kind === "settled") {
        clearPendingPostTarget();
        return true;
      }

      if (progress.kind === "waiting") {
        return false;
      }

      pendingPostTargetRef.current = progress.nextPendingPostTarget;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToIndex(progress.index, {
          align: progress.align,
          offset: progress.offset,
        });
      });
      return false;
    }, [clearPendingPostTarget, postIdToIndex]);

    /** Commits a confirmed latest-edge landing into the persisted view store. */
    const persistBottomConversationView = useCallback(() => {
      const bottomView = { kind: "bottom" } satisfies ForumConversationView;

      persistBottomOnArrivalRef.current = false;
      latestConversationView.current = bottomView;
      persistConversationView(bottomView);
    }, [persistConversationView]);

    /** Persists a latest-edge command only after the viewport actually reaches bottom. */
    const maybePersistBottomConversationView = useCallback(
      (atBottom: boolean) => {
        if (
          !shouldPersistBottomConversationView({
            hasPendingBottomPersistence: persistBottomOnArrivalRef.current,
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

    /** Opens a post directly or switches the conversation into jump mode. */
    const jumpToPostId = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const index = postIdToIndex.get(postId);
        const pendingPostTarget = createPendingPostTarget({
          align: "center",
          postId,
          reason:
            index === undefined ? "jump-session" : "in-session-post-command",
        });
        const nextView = {
          kind: "post",
          offset: 0,
          postId,
        } satisfies ForumConversationView;

        latestConversationView.current = nextView;
        persistConversationView(nextView);

        pendingLatestSessionRef.current = false;
        persistBottomOnArrivalRef.current = false;
        registerPendingPostTarget(pendingPostTarget);

        if (index !== undefined) {
          setScrollCommand({
            align: "center",
            kind: "post",
            postId,
          });
          return;
        }

        setScrollCommand(null);
        setConversationIntent({ kind: "jump", postId });
      },
      [persistConversationView, postIdToIndex, registerPendingPostTarget]
    );

    /** Returns the conversation to the live latest-post edge. */
    const scrollToLatest = useCallback(() => {
      persistBottomOnArrivalRef.current = true;
      clearPendingPostTarget();

      if (isAtLatestEdge) {
        pendingLatestSessionRef.current = false;
        scrollRef.current?.scrollToBottom();
        return;
      }

      pendingLatestSessionRef.current = true;
      setScrollCommand(null);
      setConversationIntent({ kind: "live" });
      showLatestPosts();
    }, [clearPendingPostTarget, isAtLatestEdge, showLatestPosts]);

    const forumScrollValue = useMemo(
      () => ({ jumpToPostId, scrollToLatest }),
      [jumpToPostId, scrollToLatest]
    );

    useEffect(() => {
      if (
        !(
          initialAnchorSettledRef.current &&
          !hasPendingPostTarget &&
          isAtLatestEdge &&
          conversationIntent.kind !== "live"
        )
      ) {
        return;
      }

      setConversationIntent({ kind: "live" });
    }, [conversationIntent.kind, hasPendingPostTarget, isAtLatestEdge]);

    useLayoutEffect(() => {
      const resolvedScrollCommand = resolveScrollCommand({
        command: scrollCommand,
        postIdToIndex,
      });

      if (!resolvedScrollCommand) {
        return;
      }

      requestAnimationFrame(() => {
        scrollRef.current?.scrollToIndex(resolvedScrollCommand.index, {
          align: resolvedScrollCommand.align,
          offset: resolvedScrollCommand.offset,
        });
      });
      setScrollCommand(null);
    }, [postIdToIndex, scrollCommand]);

    /** Marks the thread as read only while the live edge remains visible. */
    const handleScroll = useCallback(
      (offset: number) => {
        if (pendingPostTargetRef.current) {
          previousScrollOffsetRef.current = offset;
          return;
        }

        if (initialAnchorSettledRef.current) {
          captureCurrentConversationView(offset);
        }

        const handle = scrollRef.current;
        const atBottom = handle?.isAtBottom() ?? false;
        const isNearReadStateBottom = isNearForumReadStateBottom(handle);
        maybePersistBottomConversationView(atBottom);

        if (!(initialAnchorSettledRef.current && handle)) {
          previousScrollOffsetRef.current = offset;
          return;
        }

        const previousOffset = previousScrollOffsetRef.current;
        const viewportSize = handle.getViewportSize();
        const prefetchDistance = getForumPrefetchDistance(viewportSize);
        const isMovingUp = offset < previousOffset;
        const isMovingDown = offset > previousOffset;
        const isNearTop = offset <= prefetchDistance;
        const isNearPrefetchBottom =
          handle.getDistanceFromBottom() <= prefetchDistance;
        const shouldLoadOlder =
          hasMoreBefore &&
          !isLoadingOlder &&
          isMovingUp &&
          isNearTop &&
          !wasInTopPrefetchZoneRef.current;
        const shouldLoadNewer =
          hasMoreAfter &&
          !isLoadingNewer &&
          isMovingDown &&
          isNearPrefetchBottom &&
          !wasInBottomPrefetchZoneRef.current;

        previousScrollOffsetRef.current = offset;
        wasInTopPrefetchZoneRef.current = isNearTop;
        wasInBottomPrefetchZoneRef.current = isNearPrefetchBottom;

        if (shouldLoadOlder) {
          setIsPrepending(true);
          loadOlderPosts();
        }

        if (shouldLoadNewer) {
          loadNewerPosts();
        }

        if (!(isNearReadStateBottom && isAtLatestEdge)) {
          cancelPendingMarkRead();
          return;
        }

        scheduleMarkRead(lastPostId);
      },
      [
        cancelPendingMarkRead,
        captureCurrentConversationView,
        hasMoreAfter,
        hasMoreBefore,
        isAtLatestEdge,
        isLoadingNewer,
        isLoadingOlder,
        lastPostId,
        loadNewerPosts,
        loadOlderPosts,
        maybePersistBottomConversationView,
        scheduleMarkRead,
      ]
    );

    /** Finalizes one anchor-ready conversation session after any pending jump lands. */
    const finalizeConversationReady = useCallback(() => {
      if (initialAnchorSettledRef.current) {
        return;
      }

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

      const isNearReadStateBottom = scrollRef.current
        ? isNearForumReadStateBottom(scrollRef.current)
        : initialView?.kind === "bottom";

      previousScrollOffsetRef.current =
        scrollRef.current?.getScrollOffset() ?? 0;
      wasInTopPrefetchZoneRef.current = false;
      wasInBottomPrefetchZoneRef.current = false;

      if (!(isNearReadStateBottom && isAtLatestEdge)) {
        pendingLatestSessionRef.current = false;
        cancelPendingMarkRead();
        return;
      }

      pendingLatestSessionRef.current = false;
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

    /** Waits for any pending jump target before the forum controller settles. */
    const handleVirtualAnchorReady = useCallback(() => {
      if (!settlePendingPostTarget()) {
        return;
      }

      finalizeConversationReady();
    }, [finalizeConversationReady, settlePendingPostTarget]);

    /** Saves the latest fallback snapshot when scrolling settles or the route hides. */
    const handleScrollEnd = useCallback(() => {
      if (!settlePendingPostTarget()) {
        return;
      }

      if (!initialAnchorSettledRef.current) {
        finalizeConversationReady();
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
      finalizeConversationReady,
      maybePersistBottomConversationView,
      persistConversationView,
      settlePendingPostTarget,
    ]);

    /** Persists the latest fallback snapshot when the conversation hides. */
    useLayoutEffect(
      () => () => {
        const latestView = pendingPostTargetRef.current
          ? null
          : captureConversationView({
              items: latestItemsRef.current,
              scrollRef,
            });

        if (latestView) {
          latestConversationView.current = latestView;
          persistConversationView(latestView);
        } else {
          persistConversationView();
        }

        pendingPostTargetRef.current = null;
        pendingLatestSessionRef.current = false;
        persistBottomOnArrivalRef.current = false;
        previousScrollOffsetRef.current = 0;
        wasInTopPrefetchZoneRef.current = false;
        wasInBottomPrefetchZoneRef.current = false;
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

      if (!isNearForumReadStateBottom(scrollRef.current)) {
        return;
      }

      flushMarkRead(lastPostId);
    }, [flushMarkRead, isAtLatestEdge, lastPostId, previousLastPostId]);

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
              <Activity
                mode={isJumpMode || hasPendingPostTarget ? "visible" : "hidden"}
              >
                <JumpModeIndicator onExit={scrollToLatest} />
              </Activity>
            }
            followLatest={isAtLatestEdge}
            hideScrollButton={isJumpMode || hasPendingPostTarget}
            initialAnchor={initialAnchor}
            key={timelineSessionVersion}
            onInitialAnchorSettled={handleVirtualAnchorReady}
            onScroll={handleScroll}
            onScrollEnd={handleScrollEnd}
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
