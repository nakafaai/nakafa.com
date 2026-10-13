"use client";

import { Option } from "effect";
import { type RefObject, useEffect } from "react";
import { ARTICLES_SELECTOR, readArticleKey } from "@/components/player/article";
import { usePlayer } from "@/components/player/provider";

/**
 * Makes the question that has the learner's focus the current one, so the
 * navigator, the footer, and the keys follow a learner who works through the
 * options with the keyboard. One listener on the list serves every question.
 */
export function usePlayerFocus(list: RefObject<HTMLElement | null>) {
  const focus = usePlayer((state) => state.focus);

  useEffect(() => {
    const element = list.current;
    if (!element) {
      return;
    }
    function onFocusIn(event: FocusEvent) {
      const article =
        event.target instanceof Element
          ? event.target.closest(ARTICLES_SELECTOR)
          : null;
      const key = article ? readArticleKey(article) : Option.none();
      if (Option.isSome(key)) {
        focus(key.value);
      }
    }
    element.addEventListener("focusin", onFocusIn);
    return () => element.removeEventListener("focusin", onFocusIn);
  }, [focus, list]);
}
