"use client";

import { useReducedMotion } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { useMutation, useQueries } from "convex/react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtualizer, type VirtualizerHandle } from "virtua";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import {
  createConversationRows,
  createTranscriptPage,
  createTranscriptQueryRequests,
  FORUM_BOTTOM_THRESHOLD,
  FORUM_PAGE_SIZE,
  FORUM_TOP_LOAD_THRESHOLD,
  FORUM_VIRTUAL_BUFFER,
  getForumPostsPageResult,
  getLatestTranscriptPageResult,
} from "@/components/school/classes/forum/conversation/data/pages";
import { TranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";

/** Renders a minimal Convex-first transcript backed by reactive page queries. */
export const ForumConversationTranscript = memo(() => {
  const forum = useData((state) => state.forum);
  const forumId = useData((state) => state.forumId);
  const latestRequest = useViewport((state) => state.latestRequest);
  const updateViewport = useViewport((state) => state.updateViewport);
  const prefersReducedMotion = useReducedMotion();
  const markForumRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const [pages, setPages] = useState(() => [createTranscriptPage(null)]);
  const [isPrependingHistory, setIsPrependingHistory] = useState(false);
  const didBootstrapRef = useRef(false);
  const handleRef = useRef<VirtualizerHandle | null>(null);
  const isAtBottomRef = useRef(true);
  const isScrollToLatestPendingRef = useRef(false);
  const lastMarkedPostIdRef = useRef<string | null>(null);
  const previousLastPostIdRef = useRef<string | null>(null);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const queryRequests = useMemo(
    () => createTranscriptQueryRequests(pages, forumId, FORUM_PAGE_SIZE),
    [forumId, pages]
  );
  const queryResults = useQueries(queryRequests);
  const rows = useMemo(
    () => createConversationRows(pages, queryResults, !!forum),
    [forum, pages, queryResults]
  );
  const lastPostId = useMemo(() => {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];

      if (row?.type === "post") {
        return row.post._id;
      }
    }

    return null;
  }, [rows]);

  const scrollToLatest = useCallback(
    (smooth: boolean) => {
      if (rows.length === 0) {
        return;
      }

      handleRef.current?.scrollToIndex(rows.length - 1, {
        align: "end",
        smooth,
      });
    },
    [rows.length]
  );

  const syncViewportState = useCallback(() => {
    const scrollElement = scrollElementRef.current;

    if (!scrollElement) {
      return;
    }

    const bottomDistance = Math.max(
      0,
      scrollElement.scrollHeight -
        scrollElement.clientHeight -
        scrollElement.scrollTop
    );
    const isAtBottom = bottomDistance <= FORUM_BOTTOM_THRESHOLD;

    isAtBottomRef.current = isAtBottom;

    if (isAtBottom) {
      isScrollToLatestPendingRef.current = false;
    }

    updateViewport({
      hasPendingLatestPosts: isAtBottom ? false : undefined,
      isAtBottom,
    });
  }, [updateViewport]);

  const prependOlderPage = useCallback(() => {
    if (isPrependingHistory) {
      return;
    }

    const oldestPage = pages[0];

    if (!oldestPage) {
      return;
    }

    const oldestResult = getForumPostsPageResult(queryResults[oldestPage.id]);
    const nextCursor = oldestPage.endCursor ?? oldestResult?.continueCursor;

    if (!(oldestResult && nextCursor && !oldestResult.isDone)) {
      return;
    }

    setIsPrependingHistory(true);
    setPages((currentPages) => [
      createTranscriptPage(nextCursor),
      ...currentPages,
    ]);
  }, [isPrependingHistory, pages, queryResults]);

  const handleScroll = useCallback(() => {
    const scrollElement = scrollElementRef.current;

    if (!scrollElement) {
      return;
    }

    if (scrollElement.scrollTop <= FORUM_TOP_LOAD_THRESHOLD) {
      prependOlderPage();
    }

    syncViewportState();
  }, [prependOlderPage, syncViewportState]);

  useEffect(() => {
    setPages((currentPages) => {
      const nextPages = currentPages.map((page) => {
        const result = getForumPostsPageResult(queryResults[page.id]);

        if (!(result && !page.endCursor && result.continueCursor)) {
          return page;
        }

        return {
          ...page,
          endCursor: result.continueCursor,
        };
      });

      const didChange = nextPages.some(
        (page, index) => page.endCursor !== currentPages[index]?.endCursor
      );

      return didChange ? nextPages : currentPages;
    });
  }, [queryResults]);

  useEffect(() => {
    if (!isPrependingHistory) {
      return;
    }

    const oldestPage = pages[0];
    const oldestResult = oldestPage
      ? getForumPostsPageResult(queryResults[oldestPage.id])
      : null;

    if (!oldestResult) {
      return;
    }

    setIsPrependingHistory(false);
  }, [isPrependingHistory, pages, queryResults]);

  useLayoutEffect(() => {
    if (didBootstrapRef.current || rows.length === 0) {
      return;
    }

    didBootstrapRef.current = true;
    scrollToLatest(false);
    requestAnimationFrame(syncViewportState);
  }, [rows.length, scrollToLatest, syncViewportState]);

  useLayoutEffect(() => {
    if (!(latestRequest > 0 && rows.length > 0)) {
      return;
    }

    isScrollToLatestPendingRef.current = true;
    scrollToLatest(!prefersReducedMotion);
    requestAnimationFrame(syncViewportState);
  }, [
    latestRequest,
    prefersReducedMotion,
    rows.length,
    scrollToLatest,
    syncViewportState,
  ]);

  useLayoutEffect(() => {
    const previousLastPostId = previousLastPostIdRef.current;

    previousLastPostIdRef.current = lastPostId;

    if (
      !(previousLastPostId && lastPostId && previousLastPostId !== lastPostId)
    ) {
      return;
    }

    if (isAtBottomRef.current || isScrollToLatestPendingRef.current) {
      scrollToLatest(false);
      requestAnimationFrame(syncViewportState);
      return;
    }

    updateViewport({ hasPendingLatestPosts: true });
  }, [lastPostId, scrollToLatest, syncViewportState, updateViewport]);

  useEffect(() => {
    if (!(isAtBottomRef.current && lastPostId)) {
      return;
    }

    if (lastMarkedPostIdRef.current === lastPostId) {
      return;
    }

    lastMarkedPostIdRef.current = lastPostId;
    markForumRead({
      forumId,
      lastReadPostId: lastPostId,
    }).catch(() => undefined);
  }, [forumId, lastPostId, markForumRead]);

  const latestPageResult = getLatestTranscriptPageResult(pages, queryResults);

  if (!(forum && latestPageResult)) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      ref={scrollElementRef}
    >
      <Virtualizer
        bufferSize={FORUM_VIRTUAL_BUFFER}
        data={rows}
        onScroll={handleScroll}
        ref={handleRef}
        scrollRef={scrollElementRef}
        shift={isPrependingHistory}
      >
        {(row, index) => (
          <TranscriptRow
            key={row.type === "header" ? forum._id : row.post._id}
            nextRow={rows[index + 1]}
            previousRow={rows[index - 1]}
            row={row}
          />
        )}
      </Virtualizer>
    </div>
  );
});
ForumConversationTranscript.displayName = "ForumConversationTranscript";
