import { Array as Arr, Option } from "effect";
import { type RefObject, useEffect, useState } from "react";

/** The margin that mounts a page's editors: one viewport of the canvas above and below it. */
const NEAR_MARGIN = "100% 0px";

/** The margin that unmounts a page's editors: three viewports, so a page near the edge keeps them. */
const FAR_MARGIN = "300% 0px";

/** Whether the last report of an observer has the page inside its margin. */
const isInside = (entries: readonly IntersectionObserverEntry[]) =>
  Option.match(Arr.last(entries), {
    onNone: () => false,
    onSome: (entry) => entry.isIntersecting,
  });

/**
 * Where a page sits against the canvas. `mounted` turns on when the page comes within a viewport
 * of the canvas, and turns off only when it leaves the three-viewport margin, so a page at the edge
 * keeps its editors. `reached` tells whether the page is within the three-viewport margin, where its
 * text may be read. The observers report each change, and the state changes only in their callbacks.
 */
export function usePageWindow(
  page: RefObject<HTMLElement | null>,
  canvas: RefObject<HTMLElement | null>
) {
  const [mounted, setMounted] = useState(false);
  const [reached, setReached] = useState(false);

  useEffect(() => {
    const element = page.current;
    const root = canvas.current;
    if (element === null || root === null) {
      return;
    }

    const near = new IntersectionObserver(
      (entries) => {
        if (isInside(entries)) {
          setMounted(true);
        }
      },
      { root, rootMargin: NEAR_MARGIN }
    );
    const far = new IntersectionObserver(
      (entries) => {
        const inside = isInside(entries);
        setReached(inside);
        if (!inside) {
          setMounted(false);
        }
      },
      { root, rootMargin: FAR_MARGIN }
    );
    near.observe(element);
    far.observe(element);

    return () => {
      near.disconnect();
      far.disconnect();
    };
  }, [canvas, page]);

  return { mounted, reached };
}
