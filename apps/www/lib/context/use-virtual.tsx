"use client";

import { type RefObject, useCallback, useMemo, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import type { WindowVirtualizerHandle } from "virtua";

interface VirtualContextType {
  virtualRef: RefObject<WindowVirtualizerHandle | null>;
  scrollToIndex: (index: number) => void;
}

const VirtualContext = createContext<VirtualContextType | undefined>(undefined);

export function VirtualProvider({ children }: { children: React.ReactNode }) {
  const virtualRef = useRef<WindowVirtualizerHandle>(null);

  const scrollToIndex = useCallback((index: number) => {
    virtualRef.current?.scrollToIndex(index, {
      offset: -100,
    });
  }, []);

  const value = useMemo(
    () => ({
      virtualRef,
      scrollToIndex,
    }),
    [scrollToIndex]
  );

  return (
    <VirtualContext.Provider value={value}>{children}</VirtualContext.Provider>
  );
}

export function useVirtual<T>(selector: (context: VirtualContextType) => T): T {
  const context = useContextSelector(VirtualContext, (value) => value);
  if (context === undefined) {
    throw new Error("useVirtual must be used within a VirtualProvider.");
  }
  return selector(context);
}
