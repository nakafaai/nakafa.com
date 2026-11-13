import { useDebouncedCallback } from "@mantine/hooks";
import { useMessageScroller } from "@shadcn/react/message-scroller";
import { Array as Arr, Effect, Option } from "effect";
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type ChatPlace, keepPlace, readPlace } from "@/lib/scroll/place";

/** How close to the newest edge, in pixels, the reader still stands at it, as the scroller's own edge does. */
const END_SLACK = 8;

/** How long the view stays still before its place is kept. */
const KEEP_DELAY_MILLISECONDS = 250;

/** The place this browser kept for `chat`, read once as the chat opens. */
export function useKeptPlace(chat: string) {
  const [kept] = useState(() => Effect.runSync(readPlace(chat)));
  return kept;
}

/**
 * Where the reader stands in a message list's viewport: nothing at its newest edge, else the first message whose
 * bottom is below the view's top, how far below the content's top padding its top stands, and how many messages
 * stand from it to the newest.
 */
function placeIn(viewport: HTMLElement): Option.Option<typeof ChatPlace.Type> {
  const content = viewport.querySelector(
    "[data-slot=message-scroller-content]"
  );
  const atEnd =
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
    END_SLACK;
  if (atEnd || content === null) {
    return Option.none();
  }
  const top = viewport.getBoundingClientRect().top;
  const padding = Number.parseFloat(getComputedStyle(content).paddingTop);
  const items = Arr.filter(
    Arr.fromIterable(content.children),
    (item): item is HTMLElement =>
      item instanceof HTMLElement && item.dataset.messageId !== undefined
  );

  return Option.flatMap(
    Arr.findFirstIndex(
      items,
      (item) => item.getBoundingClientRect().bottom > top
    ),
    (index) =>
      Option.flatMap(Arr.get(items, index), (item) =>
        Option.map(Option.fromUndefinedOr(item.dataset.messageId), (id) => ({
          depth: items.length - index,
          id,
          offset: item.getBoundingClientRect().top - top - padding,
        }))
      )
  );
}

/**
 * Keeps where the reader stands in a chat, a class's chat, a thread or a chat with Nina, as a chat app does: as the
 * chat opens it brings `restore` into view before the first paint, and once the view stays still it keeps the place
 * for the next open, or forgets it when the reader stands at the newest edge, where a chat opens by default. It runs
 * after the scroller has taken its own first position, so a kept place wins over the default. It draws nothing.
 */
export function KeepPlace({
  chat,
  restore,
  viewport,
}: {
  /** The chat's key among every kept place. */
  chat: string;
  /** The place to open at, read once: the kept one, unless an unread message or the address decides. */
  restore: Option.Option<typeof ChatPlace.Type>;
  viewport: RefObject<HTMLDivElement | null>;
}) {
  const { scrollToMessage } = useMessageScroller();
  // The place comes back once, as the chat opens: a later change of the address or the read mark moves no one.
  const restored = useRef(false);
  const keep = useDebouncedCallback(() => {
    const view = viewport.current;
    // A list that left the page has no place to measure, and the place it had was kept as it settled.
    if (view === null || !view.isConnected) {
      return;
    }
    Effect.runFork(keepPlace(chat, placeIn(view)));
  }, KEEP_DELAY_MILLISECONDS);

  // The scroller takes its own first position when its first messages land, which a list that mounts empty, as Nina's
  // does, learns in a mutation observer's microtask after this effect: a later microtask brings the kept place back
  // after that position and before the first paint.
  useLayoutEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;
    queueMicrotask(() => {
      Option.map(restore, (place) =>
        scrollToMessage(place.id, {
          align: "start",
          scrollMargin: place.offset,
        })
      );
    });
  }, [restore, scrollToMessage]);

  useEffect(() => {
    const view = viewport.current;
    if (view === null) {
      return;
    }
    view.addEventListener("scroll", keep, { passive: true });
    return () => view.removeEventListener("scroll", keep);
  }, [keep, viewport]);

  return null;
}
