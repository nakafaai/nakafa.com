"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import { Nina } from "@repo/design-system/components/ui/nina";
import { cva } from "class-variance-authority";
import { Array as Arr, Schema } from "effect";
import { useEffect, useState } from "react";

/** The steps of one turn of the lock: the words, the dots falling, the lock closed. */
const StepSchema = Schema.Literals(["falling", "locked", "words"]);

/** One step of the lock. */
type Step = typeof StepSchema.Type;

/** What follows a step, and how long the step stays on screen. */
const TimingSchema = Schema.Struct({
  after: Schema.Finite,
  next: StepSchema,
});

/** The step after each one, and how long each one stays on screen. */
const NEXT: Record<Step, typeof TimingSchema.Type> = {
  falling: { after: 1200, next: "locked" },
  locked: { after: 2600, next: "words" },
  words: { after: 1600, next: "falling" },
};

/**
 * How the line of words looks at each step: whole, dots falling into the lock
 * Nina holds, or gone into it. The dots fall the height of her head, so they
 * end at her lock.
 */
const wordsVariants = cva("min-h-8 text-lg", {
  variants: {
    step: {
      falling:
        "translate-y-36 scale-75 opacity-0 transition-[translate,scale,opacity] duration-1000 ease-(--ease-in-out)",
      locked: "opacity-0",
      words: "",
    },
  },
});

/**
 * The dark room of the privacy part. Nina holds a padlock, and a line of words
 * above her turns into dots that fall into it, and she is proud once they are
 * locked away. It turns while the room is on screen, and rests on the locked
 * step with reduced motion.
 */
export function PrivacyRoom({ words }: { readonly words: string }) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("words");
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;
  const current = shouldReduceMotion ? "locked" : step;
  /** One dot for each letter, and the spaces kept, so the dots wrap at the words. */
  const dots = Arr.join(
    Arr.map(Arr.fromIterable(words), (character) =>
      character === " " ? " " : "•"
    ),
    ""
  );

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setTimeout(() => {
      setStep(NEXT[step].next);
    }, NEXT[step].after);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  return (
    <div className="grid w-full justify-items-center gap-4" ref={ref}>
      <p
        aria-hidden={current !== "words"}
        className={wordsVariants({ step: current })}
      >
        {current === "words" ? words : dots}
      </p>
      <Nina
        act="guarding"
        label=""
        mood={current === "locked" ? "proud" : "focused"}
        size={240}
        whole
      />
    </div>
  );
}
