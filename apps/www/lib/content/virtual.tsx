"use client";

import { createContext, type RefObject, use, useRef } from "react";
import type { WindowVirtualizerHandle } from "virtua";

interface VirtualContextType {
  scrollToIndex: (index: number) => void;
  virtualRef: RefObject<WindowVirtualizerHandle | null>;
}

const fallbackVirtualRef = {
  current: null,
} satisfies RefObject<WindowVirtualizerHandle | null>;

const VirtualContext = createContext<VirtualContextType>({
  scrollToIndex: () => undefined,
  virtualRef: fallbackVirtualRef,
});

/**
 * The verse anchors' `scroll-mt-44` in rem, so a jump lands a verse where a
 * link to it would: clear of the sticky headers at every width and font size.
 */
const VERSE_SCROLL_MARGIN_REM = 11;

export function VirtualProvider({ children }: { children: React.ReactNode }) {
  const virtualRef = useRef<WindowVirtualizerHandle>(null);

  const scrollToIndex = (index: number) => {
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    virtualRef.current?.scrollToIndex(index, {
      offset: -VERSE_SCROLL_MARGIN_REM * rem,
    });
  };

  const value = {
    virtualRef,
    scrollToIndex,
  };

  return <VirtualContext value={value}>{children}</VirtualContext>;
}

export function useVirtual<T>(selector: (context: VirtualContextType) => T): T {
  return selector(use(VirtualContext));
}
