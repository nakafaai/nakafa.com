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

/** One entry row: the menu button's 32 px and the 4 px below it. */
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

/**
 * The outline menu list, positioned by the virtualizer. The server renders its
 * entries in normal flow and the virtualizer positions them after hydration,
 * so the list has no gap: rows then sit at the same offsets either way.
 */
function OutlineMenu({ children, ref, style }: CustomContainerComponentProps) {
  return (
    <SidebarMenu className="gap-0" ref={ref} style={style}>
      {children}
    </SidebarMenu>
  );
}

/**
 * One outline entry row of a fixed height. The virtualizer measures a row's
 * content box, so the space below the button is height, not padding. The
 * server gives each row its offset as `top` without positioning it; a static
 * row ignores that offset until the virtualizer positions it after hydration.
 */
function OutlineMenuItem({ children, ref, style }: CustomItemComponentProps) {
  return (
    <SidebarMenuItem className="static h-9" ref={ref} style={style}>
      {children}
    </SidebarMenuItem>
  );
}
