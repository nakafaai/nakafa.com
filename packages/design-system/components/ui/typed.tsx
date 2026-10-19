"use client";

import { useReducedMotion } from "@mantine/hooks";
import { cn } from "cn";
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

/** The caret: a thin bar that blinks where the next letter goes, and takes no width. */
function Caret() {
  return (
    <span className="relative inline-block w-0">
      <span className="absolute inset-y-[0.12em] start-0.5 w-[0.08em] rounded-full bg-current motion-safe:animate-[caret-blink_1s_step-end_infinite]" />
    </span>
  );
}

/**
 * A line of text as it is written. Its whole text is laid out from the start, so
 * the letters written so far take no room that the rest of the line does not
 * already hold, and writing moves nothing while the line wraps greedily. A
 * balanced line re-breaks as letters are added, so a balanced ancestor needs a
 * `text-wrap` class between it and the line. A caret stands after the last
 * letter written while `caret` is set. Screen readers hear the whole text once,
 * and the drawn letters are hidden from them.
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
  /** The whole text, which the line keeps the size of. */
  text: string;
  /** How many letters of the text are written so far. */
  typed: number;
}) {
  return (
    <span className={cn("relative inline-grid", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span aria-hidden="true" className="col-start-1 row-start-1">
        {text.slice(0, typed)}
        {caret ? <Caret /> : null}
      </span>
    </span>
  );
}
