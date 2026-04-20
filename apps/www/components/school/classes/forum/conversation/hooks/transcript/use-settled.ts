"use client";

import type { RefObject } from "react";
import { useCallback, useRef } from "react";
import { areConversationViewsEqual } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

interface UseTranscriptSettledResult {
  latestViewRef: RefObject<ForumConversationView | null>;
  reportSettled: (view: ForumConversationView) => void;
}

/** Owns the latest semantic view snapshot and de-duplicates settled persistence writes. */
export function useTranscriptSettled({
  handleSettledView,
  latestConversationView,
}: {
  handleSettledView: (view: ForumConversationView) => void;
  latestConversationView: ForumConversationView | null;
}): UseTranscriptSettledResult {
  const latestViewRef = useRef<ForumConversationView | null>(
    latestConversationView
  );
  const lastSettledViewRef = useRef<ForumConversationView | null>(
    latestConversationView
  );

  const reportSettled = useCallback(
    (view: ForumConversationView) => {
      latestViewRef.current = view;

      if (areConversationViewsEqual(lastSettledViewRef.current, view)) {
        return;
      }

      lastSettledViewRef.current = view;
      handleSettledView(view);
    },
    [handleSettledView]
  );

  return {
    latestViewRef,
    reportSettled,
  };
}
