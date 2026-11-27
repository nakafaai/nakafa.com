import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { CurrentBalanceScene } from "@repo/design-system/components/contents/physics/field/balance/scene";
import { balancingCurrent } from "@repo/design-system/components/contents/physics/field/magnet";
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
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface CurrentBalanceLabProps {
  description: NonNullable<ReactNode>;
  /** The magnetic flux density, in teslas. */
  field: number;
  labels: {
    current: ReactNode;
    currentName: string;
    force: ReactNode;
    needed: ReactNode;
    viewLabel: string;
    weight: ReactNode;
  };
  /** The length of wire inside the field, in centimetres. */
  length: number;
  /** The mass of the wire, in grams. */
  mass: number;
  title: NonNullable<ReactNode>;
}

/**
 * A straight wire lies east to west across the gap of a magnet whose field
 * points north. A current through it feels a force F = B I l at right angles
 * to both, up for a current to the east, by Fleming's left-hand rule. Raise
 * the current until the force matches the weight and the wire floats.
 */
export function CurrentBalanceLab({
  description,
  field,
  labels,
  length,
  mass,
  title,
}: CurrentBalanceLabProps) {
  const quantity = useQuantity();
  const gravity = 10;
  const balance = balancingCurrent(
    { field, length: length / 100, mass: mass / 1000 },
    gravity,
    [0, 1, 0]
  );
  const [current, setCurrent] = useState(Math.round(balance.current * 5) / 10);
  const force = field * current * (length / 100);
  const weight = (mass / 1000) * gravity;

  return (
    <VisualCard
      onReset={() => {
        setCurrent(Math.round(balance.current * 5) / 10);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.current}</span>}
          max={Math.ceil(balance.current * 2)}
          min={0}
          name={labels.currentName}
          onValueChange={setCurrent}
          readout={<InlineMath math={quantity(current, "\\text{ A}", 1)} />}
          step={0.1}
          value={current}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={3} setting="lab">
          <Suspense fallback={null}>
            <CurrentBalanceScene current={current} share={force / weight} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.force}
            value={<InlineMath math={quantity(force, "\\text{ N}", 3)} />}
          />
          <VisualFactTabular
            label={labels.weight}
            value={<InlineMath math={quantity(weight, "\\text{ N}", 3)} />}
          />
          <VisualFactTabular
            label={labels.needed}
            value={
              <InlineMath math={quantity(balance.current, "\\text{ A}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
