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
 * The player places the page itself when it reveals a question, so the list
 * opts out of the browser's scroll anchoring: Chrome and Firefox would move the
 * page again to hold an anchor of their own choosing, and leave the question it
 * revealed under the header, where Safari, which anchors nothing, leaves it right.
 */
export function PlayerQuestions({ children }: { children: ReactNode }) {
  const list = useRef<HTMLElement>(null);
  const end = useRef<HTMLDivElement>(null);
  usePlayerFocus(list);
  usePlayerReveal(list);
  usePlayerSpy(list, end);

  return (
    <section
      className="flex flex-col gap-12 [overflow-anchor:none] **:scroll-mt-20 **:scroll-mb-20"
      ref={list}
    >
      {children}
      <div aria-hidden="true" ref={end} />
    </section>
  );
}
