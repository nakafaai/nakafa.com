"use client";

import { SidebarContent } from "@repo/design-system/components/ui/sidebar-content";
import { type ReactNode, type RefObject, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface OutlineScrollValue {
  readonly scrollRef: RefObject<HTMLDivElement | null>;
}

const missingOutlineScroll = Symbol("missing-outline-scroll");

const OutlineScrollContext = createContext<
  OutlineScrollValue | typeof missingOutlineScroll
>(missingOutlineScroll);

/** The outline panel's scrolling body, shared with the entries that virtualize. */
export function OutlineContent({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <OutlineScrollContext.Provider value={{ scrollRef }}>
      <SidebarContent ref={scrollRef}>{children}</SidebarContent>
    </OutlineScrollContext.Provider>
  );
}

/** Selects the outline body's scrolling element. */
export function useOutlineScroll<T>(
  selector: (outline: OutlineScrollValue) => T
) {
  const selected = useContextSelector(OutlineScrollContext, (value) =>
    value === missingOutlineScroll ? missingOutlineScroll : selector(value)
  );
  if (selected === missingOutlineScroll) {
    throw new Error("Outline entries must render within OutlineContent.");
  }
  return selected;
}
