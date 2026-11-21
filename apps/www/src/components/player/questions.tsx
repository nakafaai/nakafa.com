import type { ReactNode } from "react";
import { useRef } from "react";
import { usePlayerFocus } from "@/components/player/focus";
import { usePlayerReveal } from "@/components/player/reveal";
import { usePlayerSpy } from "@/components/player/watch";

/**
 * Holds the questions of the player, whichever view shows them. Every
 * descendant keeps 80 px clear of the header, and 80 px clear of the footer, when the browser scrolls it into view, so a focused
 * option is never hidden under either. The reading line of the list follows
 * the top margin, so it always falls inside a question that was just revealed.
 * The list never skips drawing a card (`content-auto-card`): a skipped card
 * stands at a fallback height until the reader reaches it, so the cards a jump
 * brings near the window would take their own height after the jump placed the
 * question and move it under the header.
 */
export function PlayerQuestions({ children }: { children: ReactNode }) {
  const list = useRef<HTMLElement>(null);
  const end = useRef<HTMLDivElement>(null);
  usePlayerFocus(list);
  usePlayerReveal(list);
  usePlayerSpy(list, end);

  return (
    <section
      className="flex flex-col gap-12 **:scroll-mt-20 **:scroll-mb-20 [&_.content-auto-card]:[content-visibility:visible]!"
      ref={list}
    >
      {children}
      <div aria-hidden="true" ref={end} />
    </section>
  );
}
