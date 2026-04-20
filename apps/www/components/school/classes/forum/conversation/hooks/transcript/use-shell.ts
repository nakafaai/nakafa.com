import type { RefObject } from "react";
import { useCallback, useRef, useState } from "react";
import type { VirtualizerHandle } from "virtua";
import { getConversationScrollMetrics } from "@/components/school/classes/forum/conversation/utils/transcript";

interface UseTranscriptShellResult {
  getMetrics: () => {
    scrollHeight: number;
    scrollOffset: number;
    viewportHeight: number;
  };
  handleRef: RefObject<VirtualizerHandle | null>;
  scrollElement: HTMLDivElement | null;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  setScrollElementRef: (element: HTMLDivElement | null) => void;
}

/** Owns the transcript scroll root refs and raw shell metrics for one Virtua instance. */
export function useTranscriptShell(): UseTranscriptShellResult {
  const handleRef = useRef<VirtualizerHandle | null>(null);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );

  /** Connects the transcript scroll root to local runtime hooks. */
  const setScrollElementRef = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
    setScrollElement(element);
  }, []);

  /** Reads current transcript metrics from the DOM root with Virtua handle fallbacks. */
  function getMetrics() {
    return getConversationScrollMetrics({
      handle: handleRef.current,
      scrollElement: scrollElementRef.current,
    });
  }

  return {
    getMetrics,
    handleRef,
    scrollElement,
    scrollElementRef,
    setScrollElementRef,
  };
}
