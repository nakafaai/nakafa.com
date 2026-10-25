import { useIntersection, useReducedMotion } from "@mantine/hooks";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import { TypedText } from "@repo/design-system/components/ui/typed";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Schema } from "effect";
import { delay } from "motion";
import { useEffect, useState } from "react";

/** A time that takes the place of the one before it. */
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
  "transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none",
  {
    variants: {
      first: { false: "-ms-3", true: "ms-0" },
      landed: {
        false: "-translate-y-8 opacity-0",
        true: "translate-y-0 opacity-100",
      },
    },
  }
);

/** How long a thing stays whole in the bubble before Nina writes the next one. */
const READ_MS = 2400;

/** The time between two letters that Nina writes. */
const LETTER_EVERY_MS = 40;

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
 * Nina writes down what the learner says, one thing at a time. Each thing is
 * written letter by letter in the bubble above her and lands on the pile of
 * notebooks beside her, and the time it was written shows under the pile. The
 * pile is complete at once with reduced motion.
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

  // The thing whose last letter Nina has written; the next one waits until it is
  // read. The first thing is written before the desk opens, so the server draws it
  // whole and the bubble never shows empty.
  const [finished, setFinished] = useState(() =>
    Option.match(Arr.head(facts), {
      onNone: () => "",
      onSome: (fact) => fact.said,
    })
  );

  useEffect(() => {
    if (!playing || written >= facts.length || finished !== latest?.said) {
      return;
    }
    return delay(() => setWritten((count) => count + 1), READ_MS / 1000);
  }, [facts.length, finished, latest?.said, playing, written]);

  return (
    <div className="grid w-full justify-items-center gap-6" ref={ref}>
      <div className="grid justify-items-center gap-4">
        {/* Every fact lies in the same cell of the chat's own bubble, so the
            bubble keeps the size of the longest one and a new fact moves
            nothing; the latest is written over them, letter by letter. */}
        <Bubble className="max-w-md" variant="muted">
          <BubbleContent aria-live="polite" className="grid">
            {Arr.map(facts, (fact) => (
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1 text-balance"
                key={fact.said}
              >
                {fact.said}
              </span>
            ))}
            {/* Each thing is a new line keyed by its words, written from its
                first letter, with the caret where the next one goes. */}
            {latest === null ? null : (
              <TypedText
                caret={finished !== latest.said}
                className="col-start-1 row-start-1 self-center text-balance"
                initial={finished === latest.said ? "written" : "erased"}
                key={latest.said}
                onDone={() => setFinished(latest.said)}
                playing={playing}
                step={LETTER_EVERY_MS}
                text={latest.said}
              />
            )}
          </BubbleContent>
        </Bubble>
        <Nina act="writing" label="" size={260} whole />
      </div>
      {/* Every notebook has its place from the start, so the row keeps its width
          and a notebook that drops in never moves the ones before it. */}
      <div className="flex h-16 items-end justify-center">
        {Arr.map(facts, (fact, index) => (
          <Thing
            className={noteVariants({
              first: index === 0,
              landed: index < shown,
            })}
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
