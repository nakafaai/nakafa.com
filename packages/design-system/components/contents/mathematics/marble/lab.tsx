import type {
  DrawEvent,
  DrawRule,
  Fraction,
  MarbleColor,
  MarbleGroup,
  Trial,
} from "@repo/design-system/components/contents/mathematics/marble/draw";
import {
  drawTrials,
  eventChance,
  jarOf,
  runningHits,
} from "@repo/design-system/components/contents/mathematics/marble/draw";
import { RUN_TRIALS } from "@repo/design-system/components/contents/mathematics/marble/run";
import { MarbleScene } from "@repo/design-system/components/contents/mathematics/marble/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** The seed of the trials, so every learner sees the same draws. */
const TRIAL_SEED = 1729;

/** The two rules, in the order the toolbar offers them. */
const RULES = ["replace", "keep"] as const satisfies readonly DrawRule[];

/** A fraction as KaTeX. */
function fraction({ denominator, numerator }: Fraction) {
  return `\\dfrac{${numerator}}{${denominator}}`;
}

/**
 * Two marbles drawn one after the other from a jar of mixed colours, again
 * and again. With replacement the first marble goes back before the second
 * draw; without it, the first stays in the dish, so the second draw meets one
 * marble fewer. A tally board records each trial's colours, and the share of
 * trials that match the lesson's event settles near the product of the two
 * draws' probabilities. Without `event`, as in a question that asks for
 * them, the footer counts the trials and nothing more.
 */
export function MarbleDrawLab({
  description,
  event,
  labels,
  marbles,
  rule: startRule = "keep",
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly event?: DrawEvent;
  readonly labels: {
    readonly both: ReactNode;
    readonly first: ReactNode;
    readonly frequency: ReactNode;
    readonly rule: string;
    readonly rules: Readonly<Record<DrawRule, string>>;
    readonly second: ReactNode;
    readonly trials: ReactNode;
    readonly viewLabel: string;
  };
  readonly marbles: readonly {
    readonly color: MarbleColor;
    readonly count: number;
  }[];
  readonly rule?: DrawRule;
  readonly title: NonNullable<ReactNode>;
}) {
  const [rule, setRule] = useState<DrawRule>(startRule);
  const [finished, setFinished] = useState(RUN_TRIALS);
  const quantity = useQuantity();
  const jar = useMemo(() => jarOf(marbles), [marbles]);
  const trials = useMemo(
    () => drawTrials(jar.length, rule, RUN_TRIALS, TRIAL_SEED),
    [jar.length, rule]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.rule}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(RULES, (each) => each === value),
              setRule
            );
          }}
          type="single"
          value={rule}
          variant="outline"
        >
          {Arr.map(RULES, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.rules[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="oak" reach={0.3} setting="lab">
          <Suspense fallback={null}>
            <MarbleScene
              jar={jar}
              onFinished={setFinished}
              rule={rule}
              trials={trials}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {event === undefined ? null : (
            <EventFacts
              event={event}
              finished={finished}
              jar={jar}
              labels={labels}
              marbles={marbles}
              rule={rule}
              trials={trials}
            />
          )}
          <VisualFactTabular
            label={labels.trials}
            value={<InlineMath math={quantity(finished, "", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The facts of the lesson's event: the probability of each draw, their
 * product, and the share of the finished trials that matched it.
 */
function EventFacts({
  event,
  finished,
  jar,
  labels,
  marbles,
  rule,
  trials,
}: {
  readonly event: DrawEvent;
  readonly finished: number;
  readonly jar: readonly MarbleColor[];
  readonly labels: {
    readonly both: ReactNode;
    readonly first: ReactNode;
    readonly frequency: ReactNode;
    readonly second: ReactNode;
  };
  readonly marbles: readonly MarbleGroup[];
  readonly rule: DrawRule;
  readonly trials: readonly Trial[];
}) {
  const quantity = useQuantity();
  const hits = useMemo(
    () => runningHits(trials, jar, event),
    [event, jar, trials]
  );
  const chance = eventChance(marbles, event, rule);
  const matched = finished > 0 ? Arr.getUnsafe(hits, finished - 1) : 0;

  return (
    <>
      <VisualFactTabular
        label={labels.first}
        value={<InlineMath math={fraction(chance.first)} />}
      />
      <VisualFactTabular
        label={labels.second}
        value={<InlineMath math={fraction(chance.second)} />}
      />
      <VisualFactTabular
        label={labels.both}
        value={
          <InlineMath
            math={`${fraction(chance.first)} \\times ${fraction(chance.second)} = ${fraction(chance.both)} \\approx ${quantity(chance.both.numerator / chance.both.denominator, "", 3)}`}
          />
        }
      />
      <VisualFactTabular
        label={labels.frequency}
        value={
          <InlineMath
            math={
              finished > 0
                ? `\\dfrac{${matched}}{${finished}} \\approx ${quantity(matched / finished, "", 3)}`
                : "0"
            }
          />
        }
      />
    </>
  );
}
