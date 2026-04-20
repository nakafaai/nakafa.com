import { useDebouncedCallback } from "@mantine/hooks";
import type { RefObject } from "react";
import { useEffectEvent } from "react";
import { FORUM_SCROLL_SETTLE_DELAY } from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  captureVisibleConversationDomAnchor,
  getConversationBottomDistance,
} from "@/components/school/classes/forum/conversation/utils/transcript";
import type { ForumConversationView } from "@/lib/store/forum";

interface UseTranscriptSettledResult {
  persistSettledView: () => void;
  reportScrollSettled: ReturnType<typeof useDebouncedCallback>;
}

/** Owns semantic settled-view capture for one transcript shell. */
export function useTranscriptSettled({
  getMetrics,
  handleSettledView,
  scrollElementRef,
}: {
  getMetrics: () => {
    scrollHeight: number;
    scrollOffset: number;
    viewportHeight: number;
  };
  handleSettledView: (view: ForumConversationView) => void;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}): UseTranscriptSettledResult {
  /** Persists the current semantic transcript view once scrolling has settled. */
  const persistSettledView = useEffectEvent(() => {
    const scrollElement = scrollElementRef.current;

    if (!scrollElement) {
      return;
    }

    if (getConversationBottomDistance(getMetrics()) <= 1) {
      handleSettledView({ kind: "bottom" });
      return;
    }

    const anchor = captureVisibleConversationDomAnchor({
      scrollElement,
    });

    if (!anchor) {
      return;
    }

    handleSettledView({
      kind: "post",
      offset: anchor.topWithinScrollRoot,
      postId: anchor.postId,
    } satisfies ForumConversationView);
  });

  /** Debounces settled-view persistence until the current scroll interaction calms down. */
  const reportScrollSettled = useDebouncedCallback(() => {
    persistSettledView();
  }, FORUM_SCROLL_SETTLE_DELAY);

  return {
    persistSettledView,
    reportScrollSettled,
  };
}
