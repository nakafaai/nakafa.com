import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import type { VirtualizerHandle } from "virtua";
import {
  type ConversationRow,
  getPostRowIndex,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  captureConversationView,
  getConversationBottomDistance,
  getConversationViewOffset,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import {
  type ConversationView,
  hasReachedConversationView,
} from "@/components/school/classes/forum/conversation/data/view";
import type { SessionStore } from "@/components/school/classes/forum/conversation/store/session";
import type { ViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";

export interface ConversationScrollRequest {
  exact: boolean;
  smooth: boolean;
  view: ConversationView;
}

/** Syncs the latest bottom-state booleans from the current Virtua handle. */
export function syncConversationViewport({
  handle,
  threshold,
  updateViewport,
}: {
  handle: VirtualizerHandle | null;
  threshold: number;
  updateViewport: ViewportStore["updateViewport"];
}) {
  if (!handle) {
    return false;
  }

  const isAtBottom = getConversationBottomDistance(handle) <= threshold;

  updateViewport({
    hasPendingLatestPosts: isAtBottom ? false : undefined,
    isAtBottom,
  });

  return isAtBottom;
}

/** Reads the current semantic transcript view from the mounted Virtua rows. */
export function getCurrentConversationView({
  handle,
  hasLoadedWindow,
  rows,
  settledView,
}: {
  handle: VirtualizerHandle | null;
  hasLoadedWindow: boolean;
  rows: ConversationRow[];
  settledView: ConversationView | null;
}) {
  if (!handle || rows.length === 0 || !hasLoadedWindow) {
    return settledView;
  }

  return captureConversationView({ handle, rows }) ?? settledView;
}

/** Persists the latest settled transcript view and advances read state at bottom. */
export function commitConversationView({
  backOrigin,
  clearBackOrigin,
  forumId,
  handle,
  hasLoadedWindow,
  lastPostId,
  markLastPostRead,
  rows,
  saveConversationView,
  settledViewRef,
}: {
  backOrigin: ConversationView | null;
  clearBackOrigin: ViewportStore["clearBackOrigin"];
  forumId: Id<"schoolClassForums">;
  handle: VirtualizerHandle | null;
  hasLoadedWindow: boolean;
  lastPostId: Id<"schoolClassForumPosts"> | null;
  markLastPostRead: (postId: Id<"schoolClassForumPosts">) => void;
  rows: ConversationRow[];
  saveConversationView: SessionStore["saveConversationView"];
  settledViewRef: RefObject<ConversationView | null>;
}) {
  if (!handle || rows.length === 0 || !hasLoadedWindow) {
    return;
  }

  const view = captureConversationView({ handle, rows });

  if (!view) {
    return;
  }

  settledViewRef.current = view;
  saveConversationView(forumId, view);

  if (backOrigin && hasReachedConversationView(view, backOrigin)) {
    clearBackOrigin();
  }

  if (view.kind !== "bottom" || !lastPostId) {
    return;
  }

  markLastPostRead(lastPostId);
}

/**
 * Scrolls to the latest visible row by using Virtua's own end alignment.
 *
 * References:
 * - https://github.com/inokawa/virtua#faqs
 * - node_modules/.pnpm/virtua@0.49.1_react-dom@19.2.5_react@19.2.5__react@19.2.5_vue@3.5.30_typescript@6.0.2_/node_modules/virtua/lib/react/Virtualizer.d.ts
 */
export function scrollConversationToBottom({
  handle,
  rowsLength,
  smooth,
}: {
  handle: VirtualizerHandle | null;
  rowsLength: number;
  smooth: boolean;
}) {
  if (!handle || rowsLength === 0) {
    return false;
  }

  handle.scrollToIndex(rowsLength - 1, {
    align: "end",
    smooth,
  });

  return true;
}

/** Executes one pending semantic scroll request once the target row exists. */
export function executeConversationScrollRequest({
  handle,
  request,
  rows,
  scrollToBottom,
}: {
  handle: VirtualizerHandle | null;
  request: ConversationScrollRequest;
  rows: ConversationRow[];
  scrollToBottom: (smooth: boolean) => boolean;
}) {
  if (!handle || rows.length === 0) {
    return false;
  }

  if (request.view.kind === "bottom") {
    scrollToBottom(request.smooth);
    return true;
  }

  const rowIndex = getPostRowIndex(rows, request.view.postId);

  if (rowIndex < 0) {
    return false;
  }

  if (request.exact) {
    handle.scrollTo(
      getConversationViewOffset({
        handle,
        index: rowIndex,
        view: request.view,
      })
    );
  } else {
    handle.scrollToIndex(rowIndex, {
      align: "center",
      smooth: request.smooth,
    });
  }

  return true;
}
