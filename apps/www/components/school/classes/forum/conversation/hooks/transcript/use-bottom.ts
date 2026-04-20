"use client";

import type { RefObject } from "react";
import { useCallback, useEffectEvent, useRef } from "react";
import type { VirtualizerHandle } from "virtua";
import { getConversationBottomDistance } from "@/components/school/classes/forum/conversation/utils/transcript";

type ScrollBehavior = "auto" | "smooth";

interface UseTranscriptBottomResult {
  armBottomPin: () => void;
  isBottomPinArmed: () => boolean;
  resetBottomPin: () => void;
  scrollToBottom: (behavior: ScrollBehavior) => void;
  syncBottomState: () => boolean;
}

/** Owns explicit bottom pinning without coupling it to transcript history or view restore. */
export function useTranscriptBottom({
  getMetrics,
  handleBottomStateChange,
  handleRef,
  scrollElementRef,
}: {
  getMetrics: () => {
    scrollHeight: number;
    scrollOffset: number;
    viewportHeight: number;
  };
  handleBottomStateChange: (nextIsAtBottom: boolean) => void;
  handleRef: RefObject<VirtualizerHandle | null>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}): UseTranscriptBottomResult {
  const pendingBottomPinRef = useRef(false);

  /** Arms one explicit bottom-pin request for the next live append or latest jump. */
  const armBottomPin = useCallback(() => {
    pendingBottomPinRef.current = true;
  }, []);

  /** Clears any pending bottom-pin request. */
  const resetBottomPin = useCallback(() => {
    pendingBottomPinRef.current = false;
  }, []);

  /** Returns whether the transcript still owes one explicit bottom pin. */
  const isBottomPinArmed = useCallback(() => pendingBottomPinRef.current, []);

  /** Scrolls the transcript shell to the real DOM bottom or the Virtua fallback size. */
  const scrollToBottom = useEffectEvent((behavior: ScrollBehavior) => {
    const scrollElement = scrollElementRef.current;

    if (scrollElement) {
      scrollElement.scrollTo({
        behavior,
        top: scrollElement.scrollHeight,
      });
      return;
    }

    handleRef.current?.scrollTo(handleRef.current.scrollSize);
  });

  /** Synchronizes the latest bottom state into selector context and clears stale bottom pins. */
  const syncBottomState = useEffectEvent(() => {
    const isAtBottom = getConversationBottomDistance(getMetrics()) <= 1;

    if (isAtBottom) {
      resetBottomPin();
    }

    handleBottomStateChange(isAtBottom);
    return isAtBottom;
  });

  return {
    armBottomPin,
    isBottomPinArmed,
    resetBottomPin,
    scrollToBottom,
    syncBottomState,
  };
}
