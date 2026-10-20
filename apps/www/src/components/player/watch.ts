import { useWindowEvent } from "@mantine/hooks";
import { Array as Arr, Option } from "effect";
import { type RefObject, useEffect } from "react";
import { ARTICLES_SELECTOR, readArticleKey } from "@/components/player/article";
import { usePlayer } from "@/components/player/provider";
import {
  endBand,
  nextBand,
  readingBand,
  readPixels,
  spyCandidate,
} from "@/components/player/spy";

/** Selects the footer, which `PlayerFooter` marks with this attribute. */
const FOOTER_SELECTOR = "[data-player-footer]";

/**
 * How far a question keeps clear of the header when it is revealed, which is
 * its scroll margin. The reading line follows it, so it stays inside a
 * question that was just revealed at any text size.
 */
function readClearance(article: Element) {
  return readPixels(window.getComputedStyle(article).scrollMarginTop);
}

/** How much of the bottom of the window the footer covers: none without a footer. */
function readFooterHeight() {
  return (
    document.querySelector(FOOTER_SELECTOR)?.getBoundingClientRect().height ?? 0
  );
}

/**
 * Follows the reader through the list with two observers that report changes,
 * so nothing is measured on each scroll: one watches the question under the
 * reading line, and one watches the end of the list, which makes the last
 * question current once the reader has scrolled there. A jump or a focus holds
 * its question current until the page moves away from where it left it. The
 * observers take the clearance and the footer from the page when they are
 * made, and again after a resize.
 */
function watchList(input: {
  end: HTMLElement;
  keys: readonly string[];
  list: HTMLElement;
  observe: (key: string) => void;
}) {
  const lastKey = Option.getOrNull(Arr.last(input.keys));
  let band: string | null = null;
  let atEnd = false;

  function publish() {
    const key = spyCandidate(
      { band, end: atEnd, scrolled: window.scrollY > 0 },
      lastKey
    );
    if (key !== null) {
      input.observe(key);
    }
  }

  /** Watches the reading line and the end of the list as the page measures them now; returns what stops both. */
  function observeList() {
    const articles = Arr.fromIterable(
      input.list.querySelectorAll(ARTICLES_SELECTOR)
    );
    const clearance = Option.flatMap(Arr.head(articles), readClearance);
    if (Option.isNone(clearance)) {
      return () => undefined;
    }
    const bandObserver = new IntersectionObserver(
      (entries) => {
        band = nextBand(
          band,
          Arr.getSomes(
            Arr.map(
              Arr.filter(entries, (entry) => entry.isIntersecting),
              (entry) => readArticleKey(entry.target)
            )
          )
        );
        publish();
      },
      {
        rootMargin: readingBand(window.innerHeight, clearance.value),
        threshold: 0,
      }
    );
    Arr.forEach(articles, (article) => bandObserver.observe(article));
    const endObserver = new IntersectionObserver(
      (entries) => {
        const latest = Arr.last(entries);
        if (Option.isSome(latest)) {
          atEnd = latest.value.isIntersecting;
          publish();
        }
      },
      { rootMargin: endBand(readFooterHeight()), threshold: 0 }
    );
    endObserver.observe(input.end);
    return () => {
      bandObserver.disconnect();
      endObserver.disconnect();
    };
  }

  // The band is as high as the viewport, and the clearance and the footer
  // follow the text size, so both observers are made again after a resize.
  let stop = observeList();
  let frame = 0;
  function onResize() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      stop();
      stop = observeList();
    });
  }
  window.addEventListener("resize", onResize);

  return () => {
    window.removeEventListener("resize", onResize);
    window.cancelAnimationFrame(frame);
    stop();
  };
}

/**
 * Keeps the current question in step with the reader in the list, and gives
 * `current` back to the reading line when the reader moves the page away from
 * a jump or a focus, with the wheel, a touch, a key, or the scrollbar.
 */
export function usePlayerSpy(
  list: RefObject<HTMLElement | null>,
  end: RefObject<HTMLElement | null>
) {
  const keys = usePlayer((state) => state.keys);
  const mode = usePlayer((state) => state.mode);
  const moved = usePlayer((state) => state.moved);
  const observe = usePlayer((state) => state.observe);

  useEffect(() => {
    if (mode !== "list" || !list.current || !end.current) {
      return;
    }
    return watchList({ end: end.current, keys, list: list.current, observe });
  }, [end, keys, list, mode, observe]);

  useWindowEvent("scroll", () => moved(window.scrollY));
}
