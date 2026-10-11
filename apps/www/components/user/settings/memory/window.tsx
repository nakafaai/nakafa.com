"use client";

import { useCallbackRef } from "@mantine/hooks";
import { cn } from "cn";
import {
  type CustomContainerComponentProps,
  type CustomItemComponentProps,
  WindowVirtualizer,
} from "virtua";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import {
  MEMORY_PAGE,
  type Memory,
} from "@/components/user/settings/memory/list";
import { MemoryRow } from "@/components/user/settings/memory/row";

/**
 * The height of one row in pixels. The window places every row it has not
 * measured at a multiple of it, and every row is exactly this tall at every
 * text size, so the list stands where the window puts it before the rows are
 * measured and after. A row holds two lines of text, which fit in it at text
 * up to one and a half times the usual size.
 */
const ROW_SIZE = 72;

/**
 * The rows of the list, of which only those in view are in the page. The page
 * scrolls the window, not a box of its own.
 *
 * The server renders the first page, and the window hands the page the same
 * rows in the same places, so hydration moves nothing. Until the learner first
 * scrolls, the window keeps the rows the server rendered. It must never be told
 * to keep more rows than there are memories, so it starts again, with a key,
 * when the learner has fewer than a page.
 */
export function MemoryWindow({ memories }: { memories: readonly Memory[] }) {
  const { remove } = useMemoryActions();
  // One function for every row, so a row renders again only when its memory changes.
  const removeRow = useCallbackRef(remove);
  const kept = Math.min(MEMORY_PAGE, memories.length);

  return (
    <WindowVirtualizer
      as={MemoryItems}
      data={memories}
      item={MemoryItem}
      itemSize={ROW_SIZE}
      key={kept}
      ssrCount={kept}
    >
      {(memory) => (
        <MemoryRow key={memory.id} memory={memory} remove={removeRow} />
      )}
    </WindowVirtualizer>
  );
}

/**
 * The list the window positions its items in. It can take the focus from a row
 * that scrolls out of the page, but no press or Tab stops on it.
 */
function MemoryItems({ children, ref, style }: CustomContainerComponentProps) {
  return (
    <ul className="outline-none" ref={ref} style={style} tabIndex={-1}>
      {children}
    </ul>
  );
}

/**
 * One item of the window: a list item with the fixed height of a row. The
 * window measures what is inside an item, so the item has no border and no
 * padding of its own, and the divider from the row before sits on the element
 * inside it, within the same height. The first item has none and still stands
 * as tall as the others.
 */
function MemoryItem({ children, index, ref, style }: CustomItemComponentProps) {
  return (
    <li ref={ref} style={{ ...style, height: ROW_SIZE }}>
      <div className={cn("h-full", index > 0 && "border-t")}>{children}</div>
    </li>
  );
}
