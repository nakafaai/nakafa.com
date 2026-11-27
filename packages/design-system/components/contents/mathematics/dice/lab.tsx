import type { DiceCount } from "@repo/design-system/components/contents/mathematics/dice/odds";
import {
  probabilityMath,
  probabilityOf,
} from "@repo/design-system/components/contents/mathematics/dice/odds";
import type { Roll } from "@repo/design-system/components/contents/mathematics/dice/roll";
import {
  hitsOf,
  planRolls,
  ROLLS,
} from "@repo/design-system/components/contents/mathematics/dice/roll";
import { DiceScene } from "@repo/design-system/components/contents/mathematics/dice/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** The target's stack and number stand out in teal, the colour of its readouts. */
const HIGHLIGHT = PLOT_COLORS.teal;

/** How far the scene reaches from the tray's middle, in metres. */
const REACH = 0.3;

/**
 * Dice rolled again and again in a felt-lined tray. Every roll adds a chip
 * to its outcome's stack behind the tray, so the stacks grow into a frequency
 * histogram, and the share of rolls that showed the target, its relative
 * frequency, settles near the target's probability: the faces 1 to 6 of one
 * die, or the sums 2 to 12 of two, counted over all 36 ordered pairs.
 * Without `target`, as in a question that asks for a probability, no stack
 * is highlighted and the footer counts the rolls only.
 */
export function DiceRollLab({
  description,
  dice,
  labels,
  target,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly dice: DiceCount;
  readonly labels: {
    readonly frequency: ReactNode;
    readonly hits: ReactNode;
    readonly probability: ReactNode;
    readonly trials: ReactNode;
    readonly viewLabel: string;
  };
  readonly target?: number;
  readonly title: NonNullable<ReactNode>;
}) {
  const rolls = useMemo(() => planRolls(dice), [dice]);
  const [settled, setSettled] = useState(ROLLS);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="maple" reach={REACH} setting="studio">
          <Suspense fallback={null}>
            <DiceScene
              dice={dice}
              highlight={HIGHLIGHT}
              onSettled={setSettled}
              rolls={rolls}
              target={target}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.trials}
            value={<InlineMath math={`n = ${settled}`} />}
          />
          {target === undefined ? null : (
            <TargetFacts
              dice={dice}
              labels={labels}
              rolls={rolls}
              settled={settled}
              target={target}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The facts of the target: how many settled rolls showed it, their share,
 * and its probability.
 */
function TargetFacts({
  dice,
  labels,
  rolls,
  settled,
  target,
}: {
  readonly dice: DiceCount;
  readonly labels: {
    readonly frequency: ReactNode;
    readonly hits: ReactNode;
    readonly probability: ReactNode;
  };
  readonly rolls: readonly Roll[];
  readonly settled: number;
  readonly target: number;
}) {
  const quantity = useQuantity();
  const hits = hitsOf(rolls, settled, target);
  const frequency =
    settled === 0
      ? "\\frac{k}{n}"
      : `\\frac{${hits}}{${settled}} \\approx ${quantity(hits / settled, "", 3)}`;
  const probability = `${probabilityMath(dice, target)} \\approx ${quantity(
    probabilityOf(dice, target),
    "",
    3
  )}`;
  return (
    <>
      <VisualFactIndicator
        indicatorColor={HIGHLIGHT}
        label={labels.hits}
        value={<InlineMath math={`k = ${hits}`} />}
      />
      <VisualFactTabular
        label={labels.frequency}
        value={<InlineMath math={frequency} />}
      />
      <VisualFactTabular
        label={labels.probability}
        value={<InlineMath math={probability} />}
      />
    </>
  );
}
