import { useEffect, useState } from "react";

const SCROLL_BOTTOM_TOLERANCE = 6;

/**
 * Find the active heading of page
 *
 * It selects the top heading by default, and the last item when reached the bottom of page.
 *
 * @param watch - An array of element ids to watch
 * @param single - only one active item at most
 * @returns Active anchor
 */
export function useAnchorObserver(watch: string[], single: boolean): string[] {
  const [activeAnchor, setActiveAnchor] = useState<string[]>([]);

  useEffect(() => {
    const visible: Set<Element> = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !visible.has(entry.target)) {
            visible.add(entry.target);
          } else if (!entry.isIntersecting && visible.has(entry.target)) {
            visible.delete(entry.target);
          }
        }

        if (visible.size > 0) {
          setActiveAnchor(Array.from(visible).map((el) => el.id));
        }
      },
      {
        rootMargin: single ? "-80px 0% -70% 0%" : "-20px 0% -40% 0%",
        threshold: 1,
      }
    );

    function onScroll(): void {
      const element = document.scrollingElement;
      if (!element) {
        return;
      }
      const top = element.scrollTop;

      if (top <= 0 && single) {
        setActiveAnchor(watch.slice(0, 1));
      } else if (
        top + element.clientHeight >=
        element.scrollHeight - SCROLL_BOTTOM_TOLERANCE
      ) {
        const visibleIds = new Set(Array.from(visible, (el) => el.id));
        const orderedVisible = watch.filter((id) => visibleIds.has(id));

        if (orderedVisible.length > 0) {
          setActiveAnchor(single ? orderedVisible.slice(0, 1) : orderedVisible);
        } else {
          const lastId = watch.at(-1);
          if (lastId) {
            setActiveAnchor([lastId]);
          }
        }
      }
    }

    for (const heading of watch) {
      const element = document.getElementById(heading);

      if (element) {
        observer.observe(element);
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [single, watch]);

  return single ? activeAnchor.slice(0, 1) : activeAnchor;
}
