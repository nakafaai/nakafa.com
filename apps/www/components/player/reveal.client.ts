"use client";

import { Option } from "effect";
import { type RefObject, useEffectEvent, useLayoutEffect } from "react";
import { findArticle } from "@/components/player/article";
import { usePlayer } from "@/components/player/provider";

/**
 * Brings the question that the store asked for into view and moves focus to
 * it, before the browser paints. The list scrolls it under the header, and one
 * at a time starts it at the top of the page, so a screen reader announces the
 * question it lands on in either view.
 */
export function usePlayerReveal(list: RefObject<HTMLElement | null>) {
  const jump = usePlayer((state) => state.jump);
  const mode = usePlayer((state) => state.mode);
  const reveal = useEffectEvent((key: string) => {
    const article = findArticle(list.current, key);
    if (Option.isNone(article)) {
      return;
    }
    if (mode === "list") {
      article.value.scrollIntoView({ behavior: "instant", block: "start" });
    } else {
      window.scrollTo({ behavior: "instant", top: 0 });
    }
    article.value.focus({ preventScroll: true });
  });

  useLayoutEffect(() => {
    if (jump) {
      reveal(jump.key);
    }
  }, [jump]);
}
