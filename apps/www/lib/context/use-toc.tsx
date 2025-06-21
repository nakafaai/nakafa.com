"use client";

import type { ParsedHeading } from "@repo/contents/_types/toc";
import { useAnchorObserver } from "@repo/design-system/hooks/use-anchor-observer";
import { type ReactNode, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { extractAllHeadingIds } from "../utils/toc";

type TocContextType = {
  activeHeadings: string[];
};

const TocContext = createContext<TocContextType | undefined>(undefined);

export function TocProvider({
  toc,
  children,
}: {
  toc: ParsedHeading[];
  children: ReactNode;
}) {
  const activeHeadings = useAnchorObserver(extractAllHeadingIds(toc), false);

  const value = useMemo(
    () => ({
      activeHeadings,
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
