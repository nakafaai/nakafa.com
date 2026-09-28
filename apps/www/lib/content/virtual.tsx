"use client";

import { type RefObject, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
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

export function VirtualProvider({ children }: { children: React.ReactNode }) {
  const virtualRef = useRef<WindowVirtualizerHandle>(null);

  const scrollToIndex = (index: number) => {
    virtualRef.current?.scrollToIndex(index, {
      offset: -100,
    });
  };

  const value = {
    virtualRef,
    scrollToIndex,
  };

  return (
    <VirtualContext.Provider value={value}>{children}</VirtualContext.Provider>
  );
}

export function useVirtual<T>(selector: (context: VirtualContextType) => T): T {
  return useContextSelector(VirtualContext, selector);
}
