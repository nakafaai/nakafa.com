"use client";

import { useWindowEvent } from "@mantine/hooks";
import { Array as Arr, Option } from "effect";
import { type RefObject, useEffect } from "react";
import { ARTICLES_SELECTOR, readArticleKey } from "@/components/player/article";
import { readKeyTarget } from "@/components/player/keyboard";
import { usePlayer } from "@/components/player/provider";
import { nextBand, readingBand, spyCandidate } from "@/components/player/spy";

/** Height of the footer, which the end of the list must clear before it counts as in view. */
const FOOTER_INSET = "0px 0px -64px 0px";

/** Keys that scroll the page when no field or widget owns them. */
const SCROLL_KEYS = [
  " ",
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
];

/**
 * Follows the reader through the list with two observers and no layout reads:
 * one watches the question under the reading line, and one watches the end of
 * the list, which makes the last question current. A jump or a focus holds its
 * question current until the reader scrolls by hand.
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
    const key = spyCandidate({ band, end: atEnd }, lastKey);
    if (key !== null) {
      input.observe(key);
    }
  }

  function observeBand() {
    const observer = new IntersectionObserver(
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
      { rootMargin: readingBand(window.innerHeight), threshold: 0 }
    );
    Arr.forEach(
      Arr.fromIterable(input.list.querySelectorAll(ARTICLES_SELECTOR)),
      (article) => observer.observe(article)
    );
    return observer;
  }

  let bandObserver = observeBand();
  const endObserver = new IntersectionObserver(
    (entries) => {
      const latest = Arr.last(entries);
      if (Option.isSome(latest)) {
        atEnd = latest.value.isIntersecting;
        publish();
      }
    },
    { rootMargin: FOOTER_INSET, threshold: 0 }
  );
  endObserver.observe(input.end);

  // The band is as high as the viewport, so it is made again after a resize.
  let frame = 0;
  function onResize() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      bandObserver.disconnect();
      bandObserver = observeBand();
    });
  }
  window.addEventListener("resize", onResize);

  return () => {
    window.removeEventListener("resize", onResize);
    window.cancelAnimationFrame(frame);
    bandObserver.disconnect();
    endObserver.disconnect();
  };
}

/**
 * Keeps the current question in step with the reader in the list, and gives
 * `current` back to the reading line when the reader scrolls by hand, with the
 * wheel, a touch, or a key that scrolls.
 */
export function usePlayerSpy(
  list: RefObject<HTMLElement | null>,
  end: RefObject<HTMLElement | null>
) {
  const keys = usePlayer((state) => state.keys);
  const mode = usePlayer((state) => state.mode);
  const observe = usePlayer((state) => state.observe);
  const release = usePlayer((state) => state.release);

  useEffect(() => {
    if (mode !== "list" || !list.current || !end.current) {
      return;
    }
    return watchList({ end: end.current, keys, list: list.current, observe });
  }, [end, keys, list, mode, observe]);

  useWindowEvent("wheel", release, { passive: true });
  useWindowEvent("touchmove", release, { passive: true });
  useWindowEvent("keydown", (event) => {
    const target = readKeyTarget(event.target);
    if (
      Arr.contains(SCROLL_KEYS, event.key) &&
      !(target.editable || target.composite)
    ) {
      release();
    }
  });
}
