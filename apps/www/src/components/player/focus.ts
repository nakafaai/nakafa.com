import { Option } from "effect";
import { type RefObject, useEffect } from "react";
import { ARTICLES_SELECTOR, readArticleKey } from "@/components/player/article";
import { usePlayer } from "@/components/player/provider";

/**
 * Makes the question that has the learner's focus the current one, so the
 * navigator, the footer, and the keys follow a learner who works through the
 * options with the keyboard. One listener on the list serves every question.
 * The browser may scroll a focused option into view right after the event, so
 * the page is anchored a frame later, where that scroll left it.
 */
export function usePlayerFocus(list: RefObject<HTMLElement | null>) {
  const anchorAt = usePlayer((state) => state.anchorAt);
  const focus = usePlayer((state) => state.focus);

  useEffect(() => {
    const element = list.current;
    if (!element) {
      return;
    }
    let frame = 0;
    function onFocusIn(event: FocusEvent) {
      const article =
        event.target instanceof Element
          ? event.target.closest(ARTICLES_SELECTOR)
          : null;
      const key = article ? readArticleKey(article) : Option.none();
      if (Option.isSome(key)) {
        focus(key.value);
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => anchorAt(window.scrollY));
      }
    }
    element.addEventListener("focusin", onFocusIn);
    return () => {
      element.removeEventListener("focusin", onFocusIn);
      window.cancelAnimationFrame(frame);
    };
  }, [anchorAt, focus, list]);
}
