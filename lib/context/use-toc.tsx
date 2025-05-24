"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type TocContextType = {
  activeHeading: string | null;
  handleIntersect: (data: {
    isIntersecting: boolean;
    entry: IntersectionObserverEntry;
  }) => void;
};

const TocContext = createContext<TocContextType | undefined>(undefined);

export function TocProvider({ children }: { children: ReactNode }) {
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const intersectingHeadings = useRef<Map<string, IntersectionObserverEntry>>(
    new Map()
  );
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  // Debounced function to update active heading
  const updateActiveHeading = useCallback(() => {
    const headings = Array.from(intersectingHeadings.current.values());

    if (headings.length === 0) {
      // Keep the last active heading when none are visible
      return;
    }

    // Sort headings by their position on the page
    headings.sort(
      (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
    );

    let bestHeading: IntersectionObserverEntry | null = null;
    const viewportHeight = window.innerHeight;
    const viewportCenter = viewportHeight / 2;

    // Strategy 1: Find heading closest to viewport center
    // This works well for normal scrolling
    let minDistanceToCenter = Number.POSITIVE_INFINITY;

    for (const heading of headings) {
      const headingCenter =
        heading.boundingClientRect.top + heading.boundingClientRect.height / 2;
      const distanceToCenter = Math.abs(headingCenter - viewportCenter);

      // Prefer headings that are:
      // 1. More visible (higher intersection ratio)
      // 2. Closer to the center of the viewport
      const score = distanceToCenter / (heading.intersectionRatio + 0.1); // Add 0.1 to avoid division by zero

      if (score < minDistanceToCenter) {
        minDistanceToCenter = score;
        bestHeading = heading;
      }
    }

    // Strategy 2: If we're at the top of the page, pick the first visible heading
    if (window.scrollY < 100 && headings.length > 0) {
      bestHeading = headings[0];
    }

    // Strategy 3: If a heading is taking up most of the viewport, prioritize it
    const dominantHeading = headings.find((h) => h.intersectionRatio > 0.7);
    if (dominantHeading) {
      bestHeading = dominantHeading;
    }

    if (bestHeading && bestHeading.target.id !== activeHeading) {
      setActiveHeading(bestHeading.target.id);
    }
  }, [activeHeading]);

  const handleIntersect = useCallback(
    (data: { isIntersecting: boolean; entry: IntersectionObserverEntry }) => {
      if (data.isIntersecting) {
        intersectingHeadings.current.set(data.entry.target.id, data.entry);
      } else {
        intersectingHeadings.current.delete(data.entry.target.id);
      }

      // Cancel any pending update
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      // Use requestAnimationFrame for smooth updates
      updateTimerRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          updateActiveHeading();
        });
      }, 0);
    },
    [updateActiveHeading]
  );

  const values = useMemo(
    () => ({ handleIntersect, activeHeading }),
    [handleIntersect, activeHeading]
  );

  return <TocContext.Provider value={values}>{children}</TocContext.Provider>;
}

export function useToc<T>(selector: (context: TocContextType) => T) {
  const context = useContextSelector(TocContext, (value) => value);
  if (context === undefined) {
    throw new Error("useToc must be used within a TocProvider.");
  }
  return selector(context);
}
