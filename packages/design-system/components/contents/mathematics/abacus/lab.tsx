import {
  clampValue,
  expandedForm,
  largestValue,
  numeral,
} from "@repo/design-system/components/contents/mathematics/abacus/place";
import { AbacusScene } from "@repo/design-system/components/contents/mathematics/abacus/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
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
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/**
 * The stage's floor sits just under the desk top, so the soft contact
 * shadows lie on the desk and its unseen shadow catcher stays inside it.
 */
const FLOOR = -0.0115;

/** How far the abacus and its pot reach from their middle, in metres. */
const REACH = 0.4;

/**
 * A classroom spike abacus counting in the base the learner picks. Its four
 * spikes stand for b^3, b^2, b and 1, and each holds as many beads as that
 * place's digit, at most b - 1. The learner sets a number and sees its
 * digits as beads, its numeral in base b, its expanded form and its value in
 * base ten. Playing adds one bead at a time: a spike that fills to b beads
 * carries, its b beads come off and one bead goes onto the next spike.
 * Without `showReadout`, as in a question that asks for the numeral or the
 * value, the slider hides its number and the footer lists nothing.
 */
export function AbacusBaseLab({
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
    readonly decimal: ReactNode;
    readonly digits: ReactNode;
    readonly expanded: ReactNode;
    readonly value: string;
    readonly viewLabel: string;
  };
  readonly showReadout?: boolean;
  readonly title: NonNullable<ReactNode>;
  readonly value: number;
}) {
  const quantity = useQuantity();
  const [base, setBase] = useState(bases[0]);
  const [number, setNumber] = useState(() => clampValue(value, bases[0]));
  const shown = clampValue(number, base);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.base}
          onValueChange={(next: string) => {
            Option.map(
              Arr.findFirst(bases, (each) => String(each) === next),
              (chosen) => {
                setBase(chosen);
                setNumber((current) => clampValue(current, chosen));
              }
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
            aria-label={labels.value}
            max={largestValue(base)}
            min={0}
            onValueChange={(next: number) => setNumber(next)}
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
        <ScienceStage floor={FLOOR} ground="oak" reach={REACH} setting="lab">
          <Suspense fallback={null}>
            <AbacusScene base={base} onStep={setNumber} value={shown} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      {showReadout ? (
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.digits}
              value={<InlineMath math={numeral(shown, base)} />}
            />
            <VisualFactTabular
              label={labels.expanded}
              value={<InlineMath math={expandedForm(shown, base)} />}
            />
            <VisualFactTabular
              label={labels.decimal}
              value={<InlineMath math={quantity(shown, "", 0)} />}
            />
          </VisualCardFacts>
        </VisualCardFooter>
      ) : null}
    </VisualCard>
  );
}
