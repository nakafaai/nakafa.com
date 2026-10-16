"use client";

import { useCallbackRef } from "@mantine/hooks";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  type CustomContainerComponentProps,
  type CustomItemComponentProps,
  WindowVirtualizer,
} from "virtua";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import { MemoryDeleteDialog } from "@/components/user/settings/memory/delete";
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
 * The rows of the list. A list of a page or more is windowed: only the rows in
 * view are in the page, and the page scrolls the window, not a box of its own.
 * A shorter list is all in the page, because there is nothing to leave out.
 *
 * The server renders the first page, and the window hands the page the same
 * rows in the same places, so hydration moves nothing. Until the learner first
 * scrolls, the window keeps exactly the `MEMORY_PAGE` rows it started with, so
 * it cannot start with more rows than there are memories, and it would not show
 * a row that a short list gained. A short list is therefore a plain list: its
 * rows stay in place while memories come and go around them, where a window
 * would start again, with every row, each time the count changed.
 */
export function MemoryWindow({ memories }: { memories: readonly Memory[] }) {
  const { remove } = useMemoryActions();
  // The memory a row asked to delete, until the learner confirms or cancels.
  const [pending, setPending] = useState<Memory | null>(null);
  // One function for every row, so a row renders again only when its memory changes.
  const askRow = useCallbackRef((memory: Memory) => setPending(memory));

  /** Removes the memory the learner confirmed, and closes the question. */
  function confirmDelete() {
    if (pending !== null) {
      remove(pending);
    }
    setPending(null);
  }

  return (
    <>
      {Arr.length(memories) < MEMORY_PAGE ? (
        <MemoryItems>
          {Arr.map(memories, (memory, index) => (
            <MemoryItem index={index} key={memory.id}>
              <MemoryRow askDelete={askRow} memory={memory} />
            </MemoryItem>
          ))}
        </MemoryItems>
      ) : (
        <WindowVirtualizer
          as={MemoryItems}
          data={memories}
          item={MemoryItem}
          itemSize={ROW_SIZE}
          ssrCount={MEMORY_PAGE}
        >
          {(memory) => (
            <MemoryRow askDelete={askRow} key={memory.id} memory={memory} />
          )}
        </WindowVirtualizer>
      )}
      <MemoryDeleteDialog
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        open={pending !== null}
      />
    </>
  );
}

/**
 * What the window gives its list and its items, with the style left out for a
 * list that has no window to place them.
 */
type Placed<Props extends { style: CSSProperties }> = Omit<Props, "style"> &
  Partial<Pick<Props, "style">>;

/**
 * The list the rows stand in. It can take the focus from a row that leaves the
 * page, but no press or Tab stops on it.
 */
function MemoryItems({
  children,
  ref,
  style,
}: Placed<CustomContainerComponentProps>) {
  return (
    <ul className="outline-none" ref={ref} style={style} tabIndex={-1}>
      {children}
    </ul>
  );
}

/**
 * One item of the list: a list item with the fixed height of a row. The window
 * measures what is inside an item, so the item has no border and no padding of
 * its own, and the divider from the row before sits on the element inside it,
 * within the same height. The first item has none and still stands as tall as
 * the others.
 */
function MemoryItem({
  children,
  index,
  ref,
  style,
}: Placed<CustomItemComponentProps>) {
  return (
    <li ref={ref} style={{ ...style, height: ROW_SIZE }}>
      <div className={cn("h-full", index > 0 && "border-t")}>{children}</div>
    </li>
  );
}
