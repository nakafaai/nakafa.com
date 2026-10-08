"use client";

import type { ParsedHeading } from "@repo/contents/toc";
import { extractAllHeadingIds } from "@repo/contents/toc";
import { Array as Arr, HashSet, MutableHashSet, Schema } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

const TocStateSchema = Schema.Struct({
  activeHeadings: Schema.Array(Schema.String),
});

/** The headings currently in the reading band, in the order they entered it. */
type TocState = typeof TocStateSchema.Type;

type TocStore = StoreApi<TocState>;

const TocContext = createContext<TocStore | null>(null);

/** Distance from the end of the page that still counts as its end. */
const SCROLL_BOTTOM_TOLERANCE = 6;

/** Keeps heading ids a stable primitive for the effect that observes them. */
const WATCH_SEPARATOR = "\n";

/**
 * Tracks the headings in the reading band with one observer for the whole
 * outline and publishes them to the store only when they change. Headings a
 * virtualized list mounts later, such as the verses after a surah's leading
 * ones, join the observer when they mount and leave it when they unmount. At
 * the end of the page, the headings still in view stay active, or the last
 * heading when none is.
 */
function observeHeadings(store: TocStore, watch: readonly string[]) {
  const watched = HashSet.fromIterable(watch);
  /** Ids of the headings in the reading band, in the order they entered it. */
  const visible = MutableHashSet.empty<string>();

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

  /** Publishes the headings in the band, keeping the last ones between them. */
  function publishVisible() {
    if (MutableHashSet.size(visible) > 0) {
      publish(Arr.fromIterable(visible));
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          MutableHashSet.add(visible, entry.target.id);
        } else {
          MutableHashSet.remove(visible, entry.target.id);
        }
      }
      publishVisible();
    },
    { rootMargin: "-20px 0% -40% 0%", threshold: 1 }
  );

  /** The watched headings in a mounted or unmounted subtree. */
  function headingsWithin(node: Node) {
    if (!(node instanceof Element)) {
      return [];
    }
    return [node, ...node.querySelectorAll("[id]")].filter((element) =>
      HashSet.has(watched, element.id)
    );
  }

  const mounts = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        for (const heading of headingsWithin(node)) {
          observer.observe(heading);
        }
      }
      for (const node of record.removedNodes) {
        for (const heading of headingsWithin(node)) {
          observer.unobserve(heading);
          MutableHashSet.remove(visible, heading.id);
        }
      }
    }
    // A heading can unmount before the observer reports it leaving the band.
    publishVisible();
  });

  function onScroll() {
    const element = document.scrollingElement;
    if (
      !element ||
      element.scrollTop + element.clientHeight <
        element.scrollHeight - SCROLL_BOTTOM_TOLERANCE
    ) {
      return;
    }
    const inView = watch.filter((id) => MutableHashSet.has(visible, id));
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
  mounts.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", onScroll);
    mounts.disconnect();
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
