import { useMemo, useSyncExternalStore } from "react";

const ANCHOR_WATCH_KEY_SEPARATOR = "\n";
const SCROLL_BOTTOM_TOLERANCE = 6;

/** Builds a primitive key for equivalent heading-id watch lists. */
function getAnchorWatchKey(watch: string[]) {
  return watch.join(ANCHOR_WATCH_KEY_SEPARATOR);
}

/** Restores heading ids from a watch-list key. */
function getAnchorWatchFromKey(watchKey: string) {
  if (watchKey.length === 0) {
    return [];
  }

  return watchKey.split(ANCHOR_WATCH_KEY_SEPARATOR);
}

function getNormalizedAnchor(
  activeAnchor: string[],
  watch: string[],
  single: boolean
) {
  const watchSet = new Set(watch);
  const currentActiveAnchor = activeAnchor.filter((id) => watchSet.has(id));

  if (currentActiveAnchor.length === 0 && single) {
    return watch.slice(0, 1);
  }

  return single ? currentActiveAnchor.slice(0, 1) : currentActiveAnchor;
}

function areAnchorsEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

function createAnchorStore(watch: string[], single: boolean) {
  const listeners = new Set<() => void>();
  let snapshot = getNormalizedAnchor([], watch, single);

  function emit(nextAnchor: string[]) {
    const nextSnapshot = getNormalizedAnchor(nextAnchor, watch, single);

    if (areAnchorsEqual(snapshot, nextSnapshot)) {
      return;
    }

    snapshot = nextSnapshot;

    for (const listener of listeners) {
      listener();
    }
  }

  function getSnapshot() {
    return snapshot;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);

    if (typeof window === "undefined") {
      return () => listeners.delete(listener);
    }

    const visible: Set<Element> = new Set();
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
          emit(Array.from(visible, (element) => element.id));
        }
      },
      {
        rootMargin: single ? "-80px 0% -70% 0%" : "-20px 0% -40% 0%",
        threshold: 1,
      }
    );

    function onScroll() {
      const element = document.scrollingElement;
      if (!element) {
        return;
      }

      if (element.scrollTop <= 0 && single) {
        emit(watch.slice(0, 1));
        return;
      }

      const isAtBottom =
        element.scrollTop + element.clientHeight >=
        element.scrollHeight - SCROLL_BOTTOM_TOLERANCE;

      if (!isAtBottom) {
        return;
      }

      const visibleIds = new Set(Array.from(visible, (item) => item.id));
      const orderedVisible = watch.filter((id) => visibleIds.has(id));

      if (orderedVisible.length > 0) {
        emit(orderedVisible);
        return;
      }

      const lastId = watch.at(-1);
      if (lastId) {
        emit([lastId]);
      }
    }

    for (const heading of watch) {
      const element = document.getElementById(heading);

      if (element) {
        observer.observe(element);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      listeners.delete(listener);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }

  return {
    getSnapshot,
    subscribe,
  };
}

/**
 * Find the active heading of page.
 *
 * It selects the top heading by default, and the last item when reached the bottom of page.
 *
 * @param watch - An array of element ids to watch
 * @param single - only one active item at most
 * @returns Active anchor
 */
export function useAnchorObserver(watch: string[], single: boolean): string[] {
  const watchKey = getAnchorWatchKey(watch);
  const store = useMemo(
    () => createAnchorStore(getAnchorWatchFromKey(watchKey), single),
    [watchKey, single]
  );

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}
