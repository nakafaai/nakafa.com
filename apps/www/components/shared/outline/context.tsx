"use client";

import type { ParsedHeading } from "@repo/contents/toc";
import { extractAllHeadingIds } from "@repo/contents/toc";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The headings currently in the reading band, in the order they entered it. */
interface TocState {
  readonly activeHeadings: readonly string[];
}

type TocStore = StoreApi<TocState>;

const TocContext = createContext<TocStore | null>(null);

/** Distance from the end of the page that still counts as its end. */
const SCROLL_BOTTOM_TOLERANCE = 6;

/** Keeps heading ids a stable primitive for the effect that observes them. */
const WATCH_SEPARATOR = "\n";

/**
 * Tracks the headings in the reading band with one observer for the whole
 * outline and publishes them to the store only when they change. At the end
 * of the page, the headings still in view stay active, or the last heading
 * when none is.
 */
function observeHeadings(store: TocStore, watch: readonly string[]) {
  const watched = new Set(watch);
  const visible = new Set<Element>();

  function publish(activeHeadings: readonly string[]) {
    const current = store.getState().activeHeadings;
    if (
      current.length === activeHeadings.length &&
      current.every((id, index) => id === activeHeadings[index])
    ) {
      return;
    }
    store.setState({ activeHeadings });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.add(entry.target);
        } else {
          visible.delete(entry.target);
        }
      }
      if (visible.size > 0) {
        publish(
          Array.from(visible, (element) => element.id).filter((id) =>
            watched.has(id)
          )
        );
      }
    },
    { rootMargin: "-20px 0% -40% 0%", threshold: 1 }
  );

  function onScroll() {
    const element = document.scrollingElement;
    if (
      !element ||
      element.scrollTop + element.clientHeight <
        element.scrollHeight - SCROLL_BOTTOM_TOLERANCE
    ) {
      return;
    }
    const visibleIds = new Set(Array.from(visible, (item) => item.id));
    const inView = watch.filter((id) => visibleIds.has(id));
    const lastId = watch.at(-1);
    if (inView.length > 0) {
      publish(inView);
    } else if (lastId) {
      publish([lastId]);
    }
  }

  publish([]);
  for (const id of watch) {
    const heading = document.getElementById(id);
    if (heading) {
      observer.observe(heading);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", onScroll);
    observer.disconnect();
  };
}

/**
 * Owns the outline's active headings in a store, so each entry subscribes to
 * its own active state and only the entries that change re-render.
 */
export function TocProvider({
  toc,
  children,
}: {
  toc: ParsedHeading[];
  children: ReactNode;
}) {
  const [store] = useState(() =>
    createStore<TocState>()(() => ({ activeHeadings: [] }))
  );
  const watchKey = extractAllHeadingIds(toc).join(WATCH_SEPARATOR);

  useEffect(
    () =>
      observeHeadings(
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
