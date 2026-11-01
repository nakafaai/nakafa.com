"use client";

import {
  type RegisteredRouter,
  useElementScrollRestoration,
  useHydrated,
  useRouter,
} from "@tanstack/react-router";
import { Array as Arr } from "effect";
import {
  Children,
  type ReactNode,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";

/** The blocks a move draws in its first frame, which fill two screens of a phone and more than one of a desktop. */
const FIRST_BLOCKS = 12;

/** The blocks each later frame adds, so no one frame styles and lays out a whole lesson. */
const NEXT_BLOCKS = 16;

/** The top-level blocks of a body or a list. A body's source holds a line break between its blocks, which draws nothing. */
function blocksOf(body: ReactNode) {
  return Arr.filter(
    Children.toArray(body),
    (block) => typeof block !== "string" || block.trim() !== ""
  );
}

/** Whether this move lands past the top of the page, which only a page that stands whole can give. */
function landsInside(router: RegisteredRouter, savedScroll: number): boolean {
  return router.latestLocation.hash !== "" || savedScroll > 0;
}

/**
 * Draws a long page's blocks a few at a time after a move. A lesson or a surah holds thousands of elements, and a
 * move commits inside one task, so a phone paid for every block before it could show the first one. The first frame now
 * holds what fills the screen, and the rest follow in transitions that a press can interrupt. The space held under
 * the blocks keeps the page's foot off the screen until they all stand. A page's first load stays whole, because
 * its HTML is, and a move to a heading or back to a place in the page stays whole too, so the place exists.
 */
export function ContentBlocks({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const router = useRouter();
  const hydrated = useHydrated();
  const saved = useElementScrollRestoration({
    getElement: () => globalThis.window,
  });
  const blocks = useMemo(() => blocksOf(children), [children]);
  const [shown, setShown] = useState(() =>
    hydrated && !landsInside(router, saved?.scrollY ?? 0)
      ? FIRST_BLOCKS
      : blocks.length
  );
  const waiting = shown < blocks.length;

  useEffect(() => {
    if (shown >= blocks.length) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      startTransition(() => setShown((drawn) => drawn + NEXT_BLOCKS));
    });
    return () => cancelAnimationFrame(frame);
  }, [blocks.length, shown]);

  return (
    <>
      {Arr.take(blocks, shown)}
      {waiting ? <div aria-hidden className="min-h-lvh" /> : null}
    </>
  );
}
