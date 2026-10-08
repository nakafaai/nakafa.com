"use client";

import { createContext, use, useRef } from "react";
import type { WindowVirtualizerHandle } from "virtua";

/**
 * The verse anchors' `scroll-mt-44` in rem, so a jump lands a verse where a
 * link to it would: clear of the sticky headers at every width and font size.
 */
const VERSE_SCROLL_MARGIN_REM = 11;

/** Builds the virtualizer handle and the verse jump that the provider shares. */
function useVirtualValue() {
  const virtualRef = useRef<WindowVirtualizerHandle>(null);

  const scrollToIndex = (index: number) => {
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    virtualRef.current?.scrollToIndex(index, {
      offset: -VERSE_SCROLL_MARGIN_REM * rem,
    });
  };

  return {
    virtualRef,
    scrollToIndex,
  };
}

type VirtualContextType = ReturnType<typeof useVirtualValue>;

const VirtualContext = createContext<VirtualContextType | null>(null);

export function VirtualProvider({ children }: { children: React.ReactNode }) {
  const value = useVirtualValue();

  return <VirtualContext value={value}>{children}</VirtualContext>;
}

export function useVirtual<T>(selector: (context: VirtualContextType) => T): T {
  const context = use(VirtualContext);
  if (!context) {
    throw new Error("useVirtual must be used within a VirtualProvider.");
  }
  return selector(context);
}
