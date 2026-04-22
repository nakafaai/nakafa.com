import type { VirtualizerHandle } from "virtua";
import {
  type ConversationRow,
  FORUM_BOTTOM_THRESHOLD,
  getPostRowIndex,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  captureConversationView,
  getConversationBottomDistance,
  getConversationViewOffset,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import {
  hasReachedConversationView,
  isConversationViewAtPost,
} from "@/components/school/classes/forum/conversation/data/view";
import type { ConversationScrollRequest } from "@/components/school/classes/forum/conversation/utils/scroll";

export const MAX_CONVERSATION_RESTORE_CORRECTIONS = 1;

/**
 * References:
 * - Virtua FAQ: `viewportSize` is `0` until ResizeObserver performs the first measurement.
 *   https://github.com/inokawa/virtua#why-vlisthandleviewportsize-is-0-on-mount
 * - Virtua handle API: `viewportSize`, `scrollTo`, and `scrollToIndex` are the
 *   supported primitives for readiness checks and imperative restore.
 *   node_modules/.pnpm/virtua@0.49.1_react-dom@19.2.5_react@19.2.5__react@19.2.5_vue@3.5.30_typescript@6.0.2_/node_modules/virtua/lib/react/Virtualizer.d.ts
 */

/** Returns whether Virtua has measured the viewport and the target row is available. */
export function canExecuteConversationScrollRequest({
  handle,
  request,
  rows,
}: {
  handle: VirtualizerHandle | null;
  request: ConversationScrollRequest;
  rows: ConversationRow[];
}) {
  if (!(handle && rows.length > 0 && handle.viewportSize > 0)) {
    return false;
  }

  if (request.view.kind === "bottom") {
    return true;
  }

  return getPostRowIndex(rows, request.view.postId) >= 0;
}

/** Performs one bounded restore correction when resize-driven measurement moved the target. */
export function settleConversationRestore({
  correctionCount,
  handle,
  request,
  rows,
}: {
  correctionCount: number;
  handle: VirtualizerHandle | null;
  request: ConversationScrollRequest;
  rows: ConversationRow[];
}) {
  if (!(handle && rows.length > 0)) {
    return {
      correctionCount,
      settled: true,
    };
  }

  if (request.view.kind === "bottom") {
    if (
      correctionCount >= MAX_CONVERSATION_RESTORE_CORRECTIONS ||
      getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD
    ) {
      return {
        correctionCount,
        settled: true,
      };
    }

    handle.scrollToIndex(rows.length - 1, { align: "end" });

    return {
      correctionCount: correctionCount + 1,
      settled: false,
    };
  }

  const rowIndex = getPostRowIndex(rows, request.view.postId);

  if (rowIndex < 0) {
    return {
      correctionCount,
      settled: true,
    };
  }

  const currentView = captureConversationView({ handle, rows });
  const hasReachedTarget = request.exact
    ? hasReachedConversationView(currentView, request.view)
    : isConversationViewAtPost(currentView, request.view.postId);

  if (
    hasReachedTarget ||
    correctionCount >= MAX_CONVERSATION_RESTORE_CORRECTIONS
  ) {
    return {
      correctionCount,
      settled: true,
    };
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
    handle.scrollToIndex(rowIndex, { align: "center" });
  }

  return {
    correctionCount: correctionCount + 1,
    settled: false,
  };
}
