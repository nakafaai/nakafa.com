"use client";

import type { ParsedHeading } from "@repo/contents/toc";
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useLayoutEffect, useRef, useState } from "react";
import {
  type CustomContainerComponentProps,
  type CustomItemComponentProps,
  Virtualizer,
} from "virtua";
import { TocProvider } from "@/components/shared/outline/context";
import { useOutlineScroll } from "@/components/shared/outline/scroll";
import {
  SidebarTreeEntry,
  SidebarTreeGroup,
} from "@/components/shared/outline/tree";

/** Entries rendered on the server, more than a tall outline panel shows. */
const OUTLINE_SERVER_ENTRIES = 40;

/** One entry: the menu button's 32 px row and the menu's 4 px gap. */
const OUTLINE_ENTRY_SIZE = 36;

/**
 * An outline for a long flat list of headings, such as a surah's verses. Only
 * the entries in view render, so the page carries a few dozen entries instead
 * of hundreds.
 */
export function SidebarVirtualTree({
  data,
  title,
}: {
  data: ParsedHeading[];
  title: string;
}) {
  const scrollRef = useOutlineScroll((outline) => outline.scrollRef);
  const listRef = useRef<HTMLDivElement>(null);
  const [startMargin, setStartMargin] = useState(0);

  // The group label sits above the entries inside the same scrolling body.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const list = listRef.current;
    if (!(scroller && list)) {
      return;
    }
    setStartMargin(
      list.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop
    );
  }, [scrollRef]);

  return (
    <SidebarTreeGroup title={title}>
      <div ref={listRef}>
        <TocProvider toc={data}>
          <Virtualizer
            as={OutlineMenu}
            data={data}
            item={OutlineMenuItem}
            itemSize={OUTLINE_ENTRY_SIZE}
            scrollRef={scrollRef}
            ssrCount={Math.min(data.length, OUTLINE_SERVER_ENTRIES)}
            startMargin={startMargin}
          >
            {(heading) => (
              <SidebarTreeEntry heading={heading} key={heading.href} />
            )}
          </Virtualizer>
        </TocProvider>
      </div>
    </SidebarTreeGroup>
  );
}

/** The outline menu list, positioned by the virtualizer. */
function OutlineMenu({ children, ref, style }: CustomContainerComponentProps) {
  return (
    <SidebarMenu ref={ref} style={style}>
      {children}
    </SidebarMenu>
  );
}

/** One outline entry row; its bottom padding stands in for the menu's gap. */
function OutlineMenuItem({ children, ref, style }: CustomItemComponentProps) {
  return (
    <SidebarMenuItem className="pb-1" ref={ref} style={style}>
      {children}
    </SidebarMenuItem>
  );
}
