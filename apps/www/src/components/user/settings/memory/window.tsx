import { useCallbackRef, useMergedRef } from "@mantine/hooks";
import { cn } from "cn";
import { Array as Arr, type Option } from "effect";
import {
  type CSSProperties,
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type CustomContainerComponentProps,
  type CustomItemComponentProps,
  WindowVirtualizer,
} from "virtua";
import { useMemoryActions } from "@/components/user/settings/memory/actions";
import { MemoryDeleteDialog } from "@/components/user/settings/memory/delete";
import {
  focusAfterDelete,
  handFocusOn,
  MEMORY_LIST_ID,
  memoryNeighbour,
  NO_NEIGHBOUR,
  NOTHING_HANDED,
  takeHandedFocus,
} from "@/components/user/settings/memory/focus";
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
 * Keeps the element of the list that held the focus as the list left the page,
 * for the list that takes the leaving one's place: it stores what a list hands
 * on and returns what was handed before.
 */
const HandedFocus = createContext<
  ((next: Option.Option<string>) => Option.Option<string>) | null
>(null);

/** Reads the window's handed focus and rejects a list outside the window. */
function useHandedFocus() {
  const exchange = use(HandedFocus);
  if (!exchange) {
    throw new TypeError("MemoryItems must be used within MemoryWindow");
  }
  return exchange;
}

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
  // The memory after the one confirmed, or before it when it was the last, read
  // when the learner confirms. It takes the focus once the delete is confirmed.
  const neighbour = useRef<Option.Option<Memory["id"]>>(NO_NEIGHBOUR);
  // The element that held the focus as one list left, for the list that takes its place.
  const handed = useRef(NOTHING_HANDED);
  const exchangeHanded = useCallbackRef((next: Option.Option<string>) => {
    const before = handed.current;
    handed.current = next;
    return before;
  });
  // Set when the learner confirms, so the question gives the focus to the neighbour.
  const confirmed = useRef(false);
  // One function for every row, so a row renders again only when its memory changes.
  const askRow = useCallbackRef((memory: Memory) => {
    confirmed.current = false;
    setPending(memory);
  });
  // A confirmed delete hands the focus to the neighbour's row. A cancelled question
  // returns it to the row that asked, as the dialog does on its own.
  const focusAfterQuestion = useCallbackRef(() =>
    confirmed.current ? focusAfterDelete(neighbour.current) : true
  );

  /** Removes the memory the learner confirmed, and closes the question. */
  function confirmDelete() {
    if (pending !== null) {
      neighbour.current = memoryNeighbour(memories, pending.id);
      confirmed.current = true;
      remove(pending);
    }
    setPending(null);
  }

  return (
    <HandedFocus value={exchangeHanded}>
      <div>
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
          finalFocus={focusAfterQuestion}
          onConfirm={confirmDelete}
          onOpenChange={(open) => {
            if (!open) {
              setPending(null);
            }
          }}
          open={pending !== null}
        />
      </div>
    </HandedFocus>
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
 * page, but no press or Tab stops on it. When the list itself leaves the page
 * with the focus in it, the focus goes to the search field, which stays, so a
 * focus that a row handed to the list is not lost. The short list and the
 * window take each other's place as the list crosses a page, and the one that
 * comes gives the focus back to the row that held it in the one that left. A
 * cancelled delete question gives the focus back on its own, and a confirmed
 * one moves it to the neighbour.
 */
function MemoryItems({
  children,
  ref,
  style,
}: Placed<CustomContainerComponentProps>) {
  const list = useRef<HTMLUListElement>(null);
  const listRef = useMergedRef(ref, list);
  const exchangeHanded = useHandedFocus();

  // The list that leaves hands the focus on in its cleanup, which runs before it
  // leaves the page, while the focus is in it; the list that takes its place
  // mounts in the same commit and takes it back.
  useLayoutEffect(() => {
    const node = list.current;
    NOTHING_HANDED.pipe(exchangeHanded, takeHandedFocus);
    return () => {
      exchangeHanded(handFocusOn(node));
    };
  }, [exchangeHanded]);

  return (
    <ul
      className="outline-none"
      id={MEMORY_LIST_ID}
      ref={listRef}
      style={style}
      tabIndex={-1}
    >
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
