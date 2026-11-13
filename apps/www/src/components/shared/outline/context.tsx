import type { ParsedHeading } from "@repo/contents/toc";
import { elementById } from "@repo/design-system/lib/element";
import { Array as Arr, Equal, Option, Schema } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import {
  outlineIds,
  readingHeading,
} from "@/components/shared/outline/reading";

const TocStateSchema = Schema.Struct({
  active: Schema.Option(Schema.String),
});

/** The heading of the section being read, while the reader is in one. */
type TocState = typeof TocStateSchema.Type;

type TocStore = StoreApi<TocState>;

const TocContext = createContext<TocStore | null>(null);

/** Distance from the end of the page that still counts as its end. */
const SCROLL_BOTTOM_TOLERANCE = 6;

/** Keeps heading ids a stable primitive for the effect that follows them. */
const WATCH_SEPARATOR = "\n";

/** The page's header, whose bottom edge the reading line never rises above. */
const PAGE_HEADER = '[data-slot="page-header"]';

/**
 * Where each heading stands now. A heading's reading line is where a jump to it
 * stops, its scroll margin, and never above the header's bottom edge, so a press
 * on an entry reads the section it opens. A heading the page has not drawn, such
 * as one in a later section that mounts as the reader nears it, has no place yet.
 */
function measurePlaces(ids: readonly string[]) {
  const header =
    document.querySelector(PAGE_HEADER)?.getBoundingClientRect().bottom ?? 0;
  return Arr.getSomes(
    Arr.map(ids, (id) =>
      Option.flatMap(Option.fromNullishOr(elementById(id)), (heading) =>
        heading.getClientRects().length === 0
          ? Option.none()
          : Option.some({
              id,
              // A jump can leave the heading a fraction of a pixel under its line.
              line:
                Math.max(
                  header,
                  Number.parseFloat(getComputedStyle(heading).scrollMarginTop)
                ) + 1,
              top: heading.getBoundingClientRect().top,
            })
      )
    )
  );
}

/** Whether the page is scrolled to its end. */
function isAtEnd() {
  const page = document.scrollingElement;
  return (
    page !== null &&
    page.scrollTop + page.clientHeight >=
      page.scrollHeight - SCROLL_BOTTOM_TOLERANCE
  );
}

/**
 * Follows the section being read, once in each frame the page scrolls, resizes
 * or grows, and publishes it only when it changes. Each frame measures every
 * heading again, so a heading that mounts late is followed as soon as it draws.
 */
function followReading(store: TocStore, ids: readonly string[]) {
  let frame = 0;

  function measure() {
    frame = 0;
    const active = readingHeading(measurePlaces(ids), {
      atEnd: isAtEnd(),
      height: window.innerHeight,
    });
    if (!Equal.equals(active, store.getState().active)) {
      store.setState({ active });
    }
  }

  function schedule() {
    if (frame === 0) {
      frame = requestAnimationFrame(measure);
    }
  }

  const grows = new ResizeObserver(schedule);
  grows.observe(document.body);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    grows.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

/**
 * Owns the outline's active heading in a store, so each entry subscribes to its
 * own active state and only the entries that change re-render.
 */
export function TocProvider({
  toc,
  children,
}: {
  toc: ParsedHeading[];
  children: ReactNode;
}) {
  const [store] = useState(() =>
    createStore<TocState>()(() => ({ active: Option.none() }))
  );
  const watchKey = Arr.join(outlineIds(toc), WATCH_SEPARATOR);

  useEffect(
    () =>
      followReading(
        store,
        watchKey.length === 0 ? [] : watchKey.split(WATCH_SEPARATOR)
      ),
    [store, watchKey]
  );

  return <TocContext value={store}>{children}</TocContext>;
}

/** Selects one value from the outline state; it re-renders only when that value changes. */
export function useToc<T>(selector: (state: TocState) => T): T {
  const store = use(TocContext);
  if (!store) {
    throw new Error("useToc must be used within a TocProvider.");
  }
  return useStore(store, selector);
}
