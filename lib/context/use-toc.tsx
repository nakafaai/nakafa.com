"use client";

import { useAnchorObserver } from "@/hooks/use-anchor-observer";
import type { ParsedHeading } from "@/types/toc";
import { type ReactNode, useMemo, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { extractAllHeadingIds } from "../utils/toc";

type TocContextType = {
  activeHeadings: string[];
  setWatchedHeadings: (headingIds: string[]) => void;
};

const TocContext = createContext<TocContextType | undefined>(undefined);

export function TocProvider({
  toc,
  children,
}: {
  toc: ParsedHeading[];
  children: ReactNode;
}) {
  const [watchedHeadings, setWatchedHeadings] = useState<string[]>(
    extractAllHeadingIds(toc)
  );

  // Use the anchor observer hook to track active headings
  const activeHeadings = useAnchorObserver(watchedHeadings, false);

  const value = useMemo(
    () => ({
      activeHeadings,
      setWatchedHeadings,
    }),
    [activeHeadings]
  );

  return <TocContext.Provider value={value}>{children}</TocContext.Provider>;
}

// Hook with selector for performance optimization
export function useToc<T>(selector: (context: TocContextType) => T): T {
  const context = useContextSelector(TocContext, (value) => value);
  if (context === undefined) {
    throw new Error("useToc must be used within a TocProvider.");
  }
  return selector(context);
}

export function useActiveHeadings(): string[] {
  return useToc((context) => context.activeHeadings);
}

export function useSetWatchedHeadings(): (headingIds: string[]) => void {
  return useToc((context) => context.setWatchedHeadings);
}
