"use client";

import { useReducedMotion } from "@mantine/hooks";
import { Number as Num } from "effect";
import { useEffect, useState } from "react";

/**
 * Counts the letters written so far toward `target`. While `playing`, one more
 * letter is written every `step` milliseconds, or one fewer when `target` is
 * lower, as a text is deleted; the count holds once it reaches `target`. With
 * reduced motion the count is `target` from the start.
 */
export function useTypedLetters(
  target: number,
  { playing, step }: { playing: boolean; step: number }
) {
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!playing || shouldReduceMotion || count === target) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCount((current) => current + Num.sign(target - current));
    }, step);
    return () => window.clearTimeout(timer);
  }, [count, playing, shouldReduceMotion, step, target]);

  return shouldReduceMotion ? target : count;
}

/**
 * The caret: a thin bar that blinks where the next letter goes. It is an empty
 * inline element, not an inline block, so it takes no width and adds no place
 * where the line may break.
 */
function Caret() {
  return (
    <span className="relative">
      <span className="absolute inset-y-[0.12em] start-0.5 w-[0.08em] rounded-full bg-current motion-safe:animate-[caret-blink_1s_step-end_infinite]" />
    </span>
  );
}

/**
 * A line of text as it is written. The whole text is laid out from the first
 * frame, with the letters not written yet invisible in place, so the line breaks,
 * aligns and balances as the finished text does and no letter moves while it is
 * written. A caret stands after the last letter written while `caret` is set.
 * Screen readers hear the whole text once, and the drawn letters are hidden from
 * them.
 */
export function TypedText({
  caret,
  className,
  text,
  typed,
}: {
  /** Whether the caret shows where the next letter goes. */
  caret: boolean;
  className?: string;
  /** The whole text, which the line keeps the layout of. */
  text: string;
  /** How many letters of the text are written so far. */
  typed: number;
}) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, typed)}
        {caret ? <Caret /> : null}
        <span className="invisible">{text.slice(typed)}</span>
      </span>
    </span>
  );
}
