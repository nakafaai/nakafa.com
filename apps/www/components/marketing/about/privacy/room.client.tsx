"use client";

import { useIntersection, useMediaQuery } from "@mantine/hooks";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { cva } from "class-variance-authority";
import { Array as Arr, Schema } from "effect";
import { useEffect, useState } from "react";

/** The query that asks for less motion. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

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

/** How the line of words looks at each step: whole, falling, or hidden behind the lock. */
const wordsVariants = cva("min-h-8 text-lg", {
  variants: {
    step: {
      falling:
        "translate-y-10 opacity-0 transition-[translate,opacity] duration-1000 ease-in",
      locked: "opacity-0",
      words: "",
    },
  },
});

/**
 * The dark room of the privacy part. Nina holds a padlock, and a line of words
 * above her turns into dots that fall into the lock, which then closes. It turns
 * once while the room is on screen, and rests on the closed lock with reduced
 * motion.
 */
export function PrivacyRoom({ words }: { readonly words: string }) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useMediaQuery(REDUCED_MOTION);
  const [step, setStep] = useState<Step>("words");
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;
  const current = shouldReduceMotion ? "locked" : step;
  const dots = Arr.join(
    Arr.makeBy(words.length, () => "•"),
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
      <Nina act="guarding" label="" size={240} whole />
      <Thing
        className={
          current === "locked"
            ? "scale-110 transition-transform duration-300"
            : "transition-transform duration-300"
        }
        name="padlock"
        size={72}
      />
    </div>
  );
}
