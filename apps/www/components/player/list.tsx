"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { readKeyTarget } from "@/components/player/keyboard";
import { PlayerArticle } from "@/components/player/question";
import {
  nextSpyBand,
  type PlayerSpy,
  readingBand,
  spyCandidate,
} from "@/components/player/spy";

/** Footer height the list end must clear before it counts as visible. */
const FOOTER_INSET = "0px 0px -64px 0px";

/** Keys that scroll the page outside fields and arrow-key widgets. */
const SCROLL_KEYS = new Set([
  " ",
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

/**
 * Renders every question in one scrolling list. Two observers follow the
 * reading line and the list end without reading layout on scroll; a jump
 * holds its question current until the reader scrolls by hand.
 */
export function PlayerList() {
  const questions = usePlayer((session) => session.state.questions);
  const focus = usePlayerView((view) => view.focus);
  const jump = usePlayerView((view) => view.jump);
  const observe = usePlayerView((view) => view.observe);
  const release = usePlayerView((view) => view.release);
  const listRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const keys = questions.map((question) => question.key).join("\n");

  useLayoutEffect(() => {
    if (!jump) {
      return;
    }
    const article = listRef.current?.querySelector<HTMLElement>(
      `[data-player-key="${CSS.escape(jump.key)}"]`
    );
    article?.scrollIntoView({ behavior: "instant", block: "start" });
    article?.focus({ preventScroll: true });
  }, [jump]);

  useEffect(() => {
    const list = listRef.current;
    const end = endRef.current;
    if (!(list && end)) {
      return;
    }
    return watchList({
      end,
      focus,
      keys: keys.split("\n"),
      list,
      observe,
      release,
    });
  }, [focus, keys, observe, release]);

  return (
    <section className="space-y-12" ref={listRef}>
      {questions.map((question) => (
        <PlayerArticle key={question.key} question={question} />
      ))}
      <div aria-hidden="true" ref={endRef} />
    </section>
  );
}

/**
 * Wires the scroll spy, the manual scroll release, and focus tracking, so the
 * question the learner works in stays current.
 */
function watchList(input: {
  readonly end: HTMLElement;
  readonly focus: (key: string) => void;
  readonly keys: readonly string[];
  readonly list: HTMLElement;
  readonly observe: (key: string) => void;
  readonly release: () => void;
}) {
  const articles = new Map<Element, string>();
  for (const key of input.keys) {
    const article = input.list.querySelector(
      `[data-player-key="${CSS.escape(key)}"]`
    );
    if (article) {
      articles.set(article, key);
    }
  }
  const lastKey = input.keys.at(-1) ?? null;
  let spy: PlayerSpy = { band: null, end: false };

  function publish() {
    const candidate = spyCandidate(spy, lastKey);
    if (candidate !== null) {
      input.observe(candidate);
    }
  }

  function createBand() {
    const observer = new IntersectionObserver(
      (entries) => {
        spy = nextSpyBand(
          spy,
          entries.flatMap((entry) => {
            const key = articles.get(entry.target);
            return key ? [{ intersecting: entry.isIntersecting, key }] : [];
          })
        );
        publish();
      },
      { rootMargin: readingBand(window.innerHeight), threshold: 0 }
    );
    for (const article of articles.keys()) {
      observer.observe(article);
    }
    return observer;
  }

  let band = createBand();
  const endObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries.at(-1);
      if (entry) {
        spy = { ...spy, end: entry.isIntersecting };
        publish();
      }
    },
    { rootMargin: FOOTER_INSET, threshold: 0 }
  );
  endObserver.observe(input.end);

  let frame = 0;
  function onResize() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      band.disconnect();
      band = createBand();
    });
  }
  function onKeyDown(event: KeyboardEvent) {
    const target = readKeyTarget(event.target);
    if (SCROLL_KEYS.has(event.key) && !(target.editable || target.composite)) {
      input.release();
    }
  }
  const release = () => input.release();
  function onFocusIn(event: FocusEvent) {
    const article =
      event.target instanceof Element
        ? event.target.closest("[data-player-key]")
        : null;
    const key = article ? articles.get(article) : undefined;
    if (key) {
      input.focus(key);
    }
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("wheel", release, { passive: true });
  window.addEventListener("touchmove", release, { passive: true });
  document.addEventListener("keydown", onKeyDown);
  input.list.addEventListener("focusin", onFocusIn);
  return () => {
    input.list.removeEventListener("focusin", onFocusIn);
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("wheel", release);
    window.removeEventListener("touchmove", release);
    document.removeEventListener("keydown", onKeyDown);
    band.disconnect();
    endObserver.disconnect();
  };
}
