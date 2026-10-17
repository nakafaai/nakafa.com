"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { cn } from "cn";
import { Array as Arr, Option, Schema } from "effect";
import { useEffect, useState } from "react";

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
        {/* Every fact lies in the same cell, so the bubble keeps the size of
            the longest one and a new fact moves nothing; only the latest shows. */}
        <p
          aria-live="polite"
          className="grid max-w-md rounded-[1.25rem] rounded-ee-md bg-muted px-4 py-2.5 font-medium text-xl leading-7 tracking-tight"
        >
          {Arr.map(facts, (fact) => (
            <span
              aria-hidden={fact !== latest}
              className={cn(
                "col-start-1 row-start-1 self-center text-balance",
                fact !== latest && "invisible"
              )}
              key={fact.said}
            >
              {fact.said}
            </span>
          ))}
        </p>
        <Nina act="writing" label="" size={260} whole />
      </div>
      <div className="flex h-16 items-end justify-center">
        {Arr.map(Arr.take(facts, shown), (fact, index) => (
          <Thing
            className={index === 0 ? "ms-0" : "-ms-3"}
            key={fact.said}
            name="note"
            size={48}
          />
        ))}
      </div>
      <p className="min-h-6 text-muted-foreground text-sm tabular-nums">
        {latest?.when}
      </p>
    </div>
  );
}
