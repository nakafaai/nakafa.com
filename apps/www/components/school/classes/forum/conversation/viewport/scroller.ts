import type { VirtualizerHandle } from "virtua";
import {
  CONVERSATION_EDGE_TOLERANCE,
  type ConversationGeometryHandle,
  getConversationBottomDistance,
} from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  captureConversationView,
  hasConversationViewReached,
  isConversationViewSettled,
  isConversationViewVisible,
} from "@/components/school/classes/forum/conversation/data/view/position";
import { getLastVisibleConversationPostId } from "@/components/school/classes/forum/conversation/data/view/visible";
import type { ViewportScroller } from "@/components/school/classes/forum/conversation/viewport/adapter";

type ScrollHandle = ConversationGeometryHandle &
  Pick<VirtualizerHandle, "scrollToIndex">;

/** Returns the correction needed when Virtua has a stale last-row offset. */
function getBottomPlacementOffset({
  handle,
  rowIndex,
}: {
  handle: ScrollHandle;
  rowIndex: number;
}) {
  const physicalBottomOffset = Math.max(
    0,
    handle.scrollSize - handle.viewportSize
  );
  const rowEndOffset =
    handle.getItemOffset(rowIndex) +
    handle.getItemSize(rowIndex) -
    handle.viewportSize;

  return physicalBottomOffset - rowEndOffset;
}

/** Creates the Virtua-backed Scroller Adapter for one live Transcript. */
export function createViewportScroller({
  getHandle,
  getTranscript,
  prefersReducedMotion,
}: {
  getHandle: () => ScrollHandle | null;
  getTranscript: () => ActiveTranscriptModel;
  prefersReducedMotion: boolean;
}) {
  const shouldSmooth = !prefersReducedMotion;

  return {
    captureView: () => {
      const handle = getHandle();

      if (!handle) {
        return null;
      }

      return captureConversationView({
        handle,
        rows: getTranscript().rows,
      });
    },

    getTranscript,

    isViewReached: (view) => {
      const handle = getHandle();

      if (!handle) {
        return false;
      }

      return hasConversationViewReached({
        handle,
        rowIndexByPostId: getTranscript().rowIndexByPostId,
        view,
      });
    },

    isViewSettled: (view) => {
      const handle = getHandle();

      if (!handle) {
        return false;
      }

      return isConversationViewSettled({
        handle,
        rowIndexByPostId: getTranscript().rowIndexByPostId,
        view,
      });
    },

    isViewVisible: (view) => {
      const handle = getHandle();

      if (!handle) {
        return false;
      }

      return isConversationViewVisible({
        handle,
        rowIndexByPostId: getTranscript().rowIndexByPostId,
        view,
      });
    },

    measure: () => {
      const handle = getHandle();

      if (!(handle && handle.viewportSize > 0)) {
        return null;
      }

      const activeTranscript = getTranscript();
      const bottomDistance = getConversationBottomDistance(handle);

      return {
        bottomDistance,
        hasOverflow:
          handle.scrollSize - handle.viewportSize > CONVERSATION_EDGE_TOLERANCE,
        isAtLatest: bottomDistance <= CONVERSATION_EDGE_TOLERANCE,
        lastVisiblePostId: getLastVisibleConversationPostId({
          handle,
          rows: activeTranscript.rows,
        }),
        offset: handle.scrollOffset,
        view: captureConversationView({
          handle,
          rows: activeTranscript.rows,
        }),
      };
    },

    place: (placement) => {
      const handle = getHandle();
      const activeTranscript = getTranscript();

      if (!handle) {
        return false;
      }

      const shouldSmoothPlacement =
        shouldSmooth && placement.motion !== "instant";

      if (placement.view.kind === "bottom") {
        const lastRowIndex = activeTranscript.rows.length - 1;

        if (lastRowIndex < 0) {
          return false;
        }

        handle.scrollToIndex(lastRowIndex, {
          align: "end",
          offset: getBottomPlacementOffset({ handle, rowIndex: lastRowIndex }),
          smooth: shouldSmoothPlacement,
        });

        return true;
      }

      const targetIndex = activeTranscript.rowIndexByPostId.get(
        placement.view.postId
      );

      if (targetIndex === undefined) {
        return false;
      }

      handle.scrollToIndex(targetIndex, {
        align: placement.align ?? "center",
        smooth: shouldSmoothPlacement,
      });

      return true;
    },
  } satisfies ViewportScroller;
}
