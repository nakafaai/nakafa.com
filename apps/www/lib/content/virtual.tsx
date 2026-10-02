"use client";

import { createContext, type RefObject, use, useRef } from "react";
import type { WindowVirtualizerHandle } from "virtua";

interface VirtualContextType {
  scrollToIndex: (index: number) => void;
  virtualRef: RefObject<WindowVirtualizerHandle | null>;
}

const VirtualContext = createContext<VirtualContextType | null>(null);

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
  const context = use(VirtualContext);
  if (!context) {
    throw new Error("useVirtual must be used within a VirtualProvider.");
  }
  return selector(context);
}
