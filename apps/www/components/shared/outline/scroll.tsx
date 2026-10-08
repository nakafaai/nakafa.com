"use client";

import { SidebarContent } from "@repo/design-system/components/ui/sidebar-content";
import { createContext, type ReactNode, use, useRef } from "react";

/** Creates the ref that the outline body's scroll element fills and that virtualized entries read. */
function useOutlineScrollValue() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return { scrollRef };
}

type OutlineScrollValue = Readonly<ReturnType<typeof useOutlineScrollValue>>;

const OutlineScrollContext = createContext<OutlineScrollValue | null>(null);

/** The outline panel's scrolling body, shared with the entries that virtualize. */
export function OutlineContent({ children }: { children: ReactNode }) {
  const { scrollRef } = useOutlineScrollValue();

  return (
    <OutlineScrollContext value={{ scrollRef }}>
      <SidebarContent ref={scrollRef}>{children}</SidebarContent>
    </OutlineScrollContext>
  );
}

/** Selects the outline body's scrolling element. */
export function useOutlineScroll<T>(
  selector: (outline: OutlineScrollValue) => T
) {
  const value = use(OutlineScrollContext);
  if (!value) {
    throw new Error("Outline entries must render within OutlineContent.");
  }
  return selector(value);
}
