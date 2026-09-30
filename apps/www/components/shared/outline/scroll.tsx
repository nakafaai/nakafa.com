"use client";

import { SidebarContent } from "@repo/design-system/components/ui/sidebar-content";
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useRef,
} from "react";

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
  if (value === missingOutlineScroll) {
    throw new Error("Outline entries must render within OutlineContent.");
  }
  return selector(value);
}
