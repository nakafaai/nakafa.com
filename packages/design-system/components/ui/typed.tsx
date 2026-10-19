"use client";

import { animate } from "motion";
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

/** Where a typed line goes, or starts: every letter written, or none. */
type TypedEnd = "erased" | "written";

/** One blink of the caret: on for half a second, then off for half a second. */
const CARET_BLINK = {
  keyframes: [1, 1, 0, 0],
  times: [0, 0.5, 0.5, 1],
};

/**
 * The caret: a thin bar where the next letter goes. It is an empty inline
 * element, not an inline block, so it takes no width and adds no place where
 * the line may break. Like a text field's caret it stays on while letters are
 * written and blinks, through Motion, while the line rests.
 */
function Caret({ blinking }: { blinking: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (bar === null || !blinking) {
      return;
    }
    const controls = animate(
      bar,
      { opacity: CARET_BLINK.keyframes },
      {
        duration: 1,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
        times: CARET_BLINK.times,
      }
    );
    // Cancelling takes the blink off, so the caret is on again while letters are written.
    return () => controls.cancel();
  }, [blinking]);

  return (
    <span className="relative">
      <span
        className="absolute inset-y-[0.12em] start-0.5 w-[0.08em] rounded-full bg-current"
        ref={ref}
      />
    </span>
  );
}

/**
 * A line of text that Motion writes letter by letter, `step` milliseconds a
 * letter, while `playing`, toward `target`: every letter written, or none left
 * as it is deleted. It starts at `initial` and holds where it is while it is not
 * playing. The whole text is laid out from the first frame, with the letters not
 * written yet invisible in place, so the line breaks, aligns and balances as the
 * finished text does and no letter moves while it is written. A caret stands
 * after the last letter while `caret` is set. `onDone` runs when the line reaches
 * its target. With reduced motion the whole text shows at once, with no caret.
 * Screen readers hear the whole text once, and the drawn letters are hidden from
 * them.
 */
export function TypedText({
  caret,
  className,
  initial = "erased",
  onDone,
  playing,
  step,
  target = "written",
  text,
}: {
  /** Whether the caret shows where the next letter goes. */
  caret: boolean;
  className?: string;
  /** Where the line starts: with no letter written, or with every letter. */
  initial?: TypedEnd;
  /** Runs when the line reaches its target. */
  onDone?: () => void;
  /** Whether the line moves toward its target now. */
  playing: boolean;
  /** The time each letter takes, in milliseconds. */
  step: number;
  /** Where the line goes: every letter written, or every letter deleted. */
  target?: TypedEnd;
  /** The whole text, which the line keeps the layout of. */
  text: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const letters = useMotionValue(initial === "written" ? text.length : 0);
  const [written, setWritten] = useState(() => letters.get());
  const finish = useEffectEvent(() => onDone?.());
  const end = target === "written" ? text.length : 0;

  useMotionValueEvent(letters, "change", (latest) => {
    setWritten(Math.round(latest));
  });

  useEffect(() => {
    if (!playing || shouldReduceMotion) {
      return;
    }
    const start = letters.get();
    if (start === end) {
      return;
    }
    const controls = animate(letters, end, {
      duration: (Math.abs(end - start) * step) / 1000,
      ease: "linear",
      onComplete: finish,
    });
    return () => controls.stop();
  }, [end, letters, playing, shouldReduceMotion, step]);

  const shown = shouldReduceMotion ? text.length : written;
  // The line rests when it is not playing or has reached its target; the caret blinks then.
  const resting = !playing || shown === end;

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, shown)}
        {caret && !shouldReduceMotion ? <Caret blinking={resting} /> : null}
        <span className="invisible">{text.slice(shown)}</span>
      </span>
    </span>
  );
}
