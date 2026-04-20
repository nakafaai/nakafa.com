"use client";

import type { RefObject } from "react";
import { useCallback, useRef } from "react";

const TRANSCRIPT_BOTTOM_EPSILON = 2;

interface UseTranscriptBottomResult {
  isAtTranscriptBottom: () => boolean;
  isBottomPinnedRef: RefObject<boolean>;
  pendingBottomPersistenceRef: RefObject<boolean>;
  pendingBottomPinRef: RefObject<boolean>;
  resetBottom: () => void;
  syncBottom: () => boolean;
}

/** Owns explicit bottom pinning state without coupling it to DOM or virtualizer refs. */
export function useTranscriptBottom({
  getDistanceFromBottom,
  handleBottomChange,
}: {
  getDistanceFromBottom: () => number;
  handleBottomChange: (nextIsAtBottom: boolean) => void;
}): UseTranscriptBottomResult {
  const pendingBottomPersistenceRef = useRef(false);
  const pendingBottomPinRef = useRef(false);
  const isBottomPinnedRef = useRef(false);

  const isAtTranscriptBottom = useCallback(
    () => getDistanceFromBottom() <= TRANSCRIPT_BOTTOM_EPSILON,
    [getDistanceFromBottom]
  );

  const syncBottom = useCallback(() => {
    const atBottom = isAtTranscriptBottom();

    if (atBottom) {
      if (pendingBottomPinRef.current) {
        pendingBottomPinRef.current = false;
        isBottomPinnedRef.current = true;
      }
    } else {
      pendingBottomPinRef.current = false;
      isBottomPinnedRef.current = false;
    }

    handleBottomChange(atBottom);
    return atBottom;
  }, [handleBottomChange, isAtTranscriptBottom]);

  const resetBottom = useCallback(() => {
    pendingBottomPersistenceRef.current = false;
    pendingBottomPinRef.current = false;
    isBottomPinnedRef.current = false;
  }, []);

  return {
    isAtTranscriptBottom,
    isBottomPinnedRef,
    pendingBottomPersistenceRef,
    pendingBottomPinRef,
    resetBottom,
    syncBottom,
  };
}
