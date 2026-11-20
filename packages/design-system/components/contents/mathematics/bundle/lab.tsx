import {
  clampCount,
  FEWEST_STICKS,
  ladderMath,
  largestCount,
  numeralMath,
} from "@repo/design-system/components/contents/mathematics/bundle/digits";
import { BundleScene } from "@repo/design-system/components/contents/mathematics/bundle/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { type ReactNode, Suspense, useState } from "react";

/** How far the zones and the heap reach from the middle of the desk, in metres. */
const REACH = 0.55;

/**
 * Turning a count in base ten into base b by bundling. A heap of ice-cream
 * sticks is tied into bundles of b, the bundles are boxed b to a box, and
 * the boxes go b to a tray. Each round is one division by b: what it makes
 * goes on to the next round, and what it leaves behind is a digit, so the
 * trays, boxes, bundles and loose sticks read the numeral from left to
 * right. The learner picks the base and the number of sticks, and plays the
 * rounds. Without `showReadout`, as in a question that asks for the numeral,
 * the slider hides its number, the zones show no digit, no caption reads
 * the divisions, and the footer lists nothing.
 */
export function BundleCountLab({
  bases,
  description,
  labels,
  showReadout = false,
  title,
  value,
}: {
  readonly bases: readonly [number, ...number[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly base: string;
    readonly count: string;
    readonly ladder: ReactNode;
    readonly numeral: ReactNode;
    readonly viewLabel: string;
  };
  readonly showReadout?: boolean;
  readonly title: NonNullable<ReactNode>;
  readonly value: number;
}) {
  const [base, setBase] = useState(bases[0]);
  const [count, setCount] = useState(() => clampCount(value, bases[0]));
  const shown = clampCount(count, base);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.base}
          onValueChange={(next: string) => {
            Option.map(
              Arr.findFirst(bases, (each) => String(each) === next),
              setBase
            );
          }}
          type="single"
          value={String(base)}
          variant="outline"
        >
          {Arr.map(bases, (each) => (
            <ToggleGroupItem key={each} value={String(each)}>
              <InlineMath math={String(each)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex min-w-48 flex-1 items-center">
          <Slider
            aria-label={labels.count}
            max={largestCount(base)}
            min={FEWEST_STICKS}
            onValueChange={(next: number) => setCount(next)}
            step={1}
            value={shown}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={REACH} setting="lab">
          <Suspense fallback={null}>
            <BundleScene base={base} count={shown} showReadout={showReadout} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      {showReadout ? (
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.ladder}
              value={<InlineMath math={ladderMath(shown, base)} />}
            />
            <VisualFactTabular
              label={labels.numeral}
              value={<InlineMath math={numeralMath(shown, base)} />}
            />
          </VisualCardFacts>
        </VisualCardFooter>
      ) : null}
    </VisualCard>
  );
}
