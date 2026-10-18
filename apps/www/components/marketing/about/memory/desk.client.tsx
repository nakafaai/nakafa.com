"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Schema } from "effect";
import { useEffect, useState } from "react";

/** A fact or a time that takes the place of the one before it. */
const swapVariants = cva(
  "col-start-1 row-start-1 self-center text-balance transition-[opacity,filter,translate,visibility] duration-300 ease-out motion-reduce:transition-none",
  {
    variants: {
      shown: {
        false: "invisible translate-y-1 opacity-0 blur-xs",
        true: "visible translate-y-0 opacity-100 blur-none",
      },
    },
  }
);

/** A notebook that drops onto the pile when Nina writes it, each a little over the one before. */
const noteVariants = cva(
  "starting:-translate-y-8 starting:opacity-0 transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none",
  { variants: { first: { false: "-ms-3", true: "ms-0" } } }
);

/** The time between two things that Nina writes down. */
const WRITE_EVERY_MS = 2400;

/** The shape of one fact that the desk writes down. */
const FactSchema = Schema.Struct({
  said: Schema.String,
  when: Schema.String,
});

/** One thing the learner says, and the time that Nina writes it down. */
type Fact = typeof FactSchema.Type;

interface MemoryDeskProps {
  readonly facts: readonly Fact[];
}

/**
 * Nina writes down what the learner says, one thing at a time. Each thing lands
 * on the pile of notebooks beside her, and the time it was written shows under
 * the pile. The pile is complete at once with reduced motion.
 */
export function MemoryDesk({ facts }: MemoryDeskProps) {
  const { entry, ref } = useIntersection({ threshold: 0.5 });
  const shouldReduceMotion = useReducedMotion();
  // The first thing is written as the desk opens, so the bubble never shows
  // empty.
  const [written, setWritten] = useState(1);
  const playing = (entry?.isIntersecting ?? false) && !shouldReduceMotion;
  const shown = shouldReduceMotion ? facts.length : written;
  const latest = Option.getOrNull(Arr.get(facts, shown - 1));

  useEffect(() => {
    if (!playing || written >= facts.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      setWritten((count) => count + 1);
    }, WRITE_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [facts.length, playing, written]);

  return (
    <div className="grid w-full justify-items-center gap-6" ref={ref}>
      <div className="grid justify-items-center gap-4">
        {/* Every fact lies in the same cell of the chat's own bubble, so the
            bubble keeps the size of the longest one and a new fact moves
            nothing; the latest comes in sharp as the one before blurs away. */}
        <Bubble className="max-w-md" variant="muted">
          <BubbleContent aria-live="polite" className="grid">
            {Arr.map(facts, (fact) => (
              <span
                aria-hidden={fact !== latest}
                className={swapVariants({ shown: fact === latest })}
                key={fact.said}
              >
                {fact.said}
              </span>
            ))}
          </BubbleContent>
        </Bubble>
        <Nina act="writing" label="" size={260} whole />
      </div>
      <div className="flex h-16 items-end justify-center">
        {Arr.map(Arr.take(facts, shown), (fact, index) => (
          <Thing
            className={noteVariants({ first: index === 0 })}
            key={fact.said}
            name="note"
            size={48}
          />
        ))}
      </div>
      <p className="grid min-h-6 text-muted-foreground text-sm tabular-nums">
        {Arr.map(Arr.dedupe(Arr.map(facts, (fact) => fact.when)), (when) => (
          <span
            aria-hidden={when !== latest?.when}
            className={swapVariants({ shown: when === latest?.when })}
            key={when}
          >
            {when}
          </span>
        ))}
      </p>
    </div>
  );
}
