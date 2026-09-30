"use client";

import type { ParsedHeading } from "@repo/contents/toc";
import { extractAllHeadingIds } from "@repo/contents/toc";
import { useAnchorObserver } from "@repo/design-system/hooks/use-anchor-observer";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface TocContextType {
  activeHeadings: string[];
}

const TocContext = createContext<TocContextType | undefined>(undefined);
const missingTocContext = Symbol("missing-toc-context");

export function TocProvider({
  toc,
  children,
}: {
  toc: ParsedHeading[];
  children: ReactNode;
}) {
  const activeHeadings = useAnchorObserver(extractAllHeadingIds(toc), false);

  const value = {
    activeHeadings,
  };

  return <TocContext.Provider value={value}>{children}</TocContext.Provider>;
}

/**
 * Selects one value from the outline state, so a consumer re-renders only when
 * its selection changes rather than whenever any heading becomes active.
 */
export function useToc<T>(selector: (context: TocContextType) => T): T {
  const selected = useContextSelector(TocContext, (value) =>
    value === undefined ? missingTocContext : selector(value)
  );
  if (selected === missingTocContext) {
    throw new Error("useToc must be used within a TocProvider.");
  }
  return selected;
}
