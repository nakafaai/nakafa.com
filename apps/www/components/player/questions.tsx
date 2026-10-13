"use client";

import { type ReactNode, useRef } from "react";
import { usePlayerFocus } from "@/components/player/focus.client";
import { usePlayerReveal } from "@/components/player/reveal.client";
import { usePlayerSpy } from "@/components/player/spy.client";

/**
 * Holds the questions of the player, whichever view shows them. Every
 * descendant keeps 80 px clear of the header and the footer when the browser
 * scrolls it into view, so a focused option is never hidden under either. The
 * reading line of the list follows this margin, so it always falls inside a
 * question that was just revealed.
 */
export function PlayerQuestions({ children }: { children: ReactNode }) {
  const list = useRef<HTMLElement>(null);
  const end = useRef<HTMLDivElement>(null);
  usePlayerFocus(list);
  usePlayerReveal(list);
  usePlayerSpy(list, end);

  return (
    <section className="flex flex-col gap-12 **:scroll-my-20" ref={list}>
      {children}
      <div aria-hidden="true" ref={end} />
    </section>
  );
}
