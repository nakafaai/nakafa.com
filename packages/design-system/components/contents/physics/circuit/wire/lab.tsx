import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { wireRatios } from "@repo/design-system/components/contents/physics/circuit/current";
import { WireResistanceScene } from "@repo/design-system/components/contents/physics/circuit/wire/scene";
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

interface WireResistanceLabProps {
  description: NonNullable<ReactNode>;
  /** How many times the first wire's diameter the second wire starts at. */
  diameterRatio: number;
  labels: {
    diameter: ReactNode;
    diameterName: string;
    length: ReactNode;
    lengthName: string;
    power: ReactNode;
    resistance: ReactNode;
    viewLabel: string;
  };
  /** How many times the first wire's length the second wire starts at. */
  lengthRatio: number;
  title: NonNullable<ReactNode>;
}

/**
 * Two nichrome wires on the same fixed voltage, drawn to scale. A wire's
 * resistance grows with its length and falls with its cross-sectional area,
 * which grows with the square of its diameter, and at a fixed voltage its
 * power is V²/R. Change the second wire's length and diameter and watch which
 * wire glows hotter.
 */
export function WireResistanceLab({
  description,
  diameterRatio,
  labels,
  lengthRatio,
  title,
}: WireResistanceLabProps) {
  const quantity = useQuantity();
  const [length, setLength] = useState(lengthRatio);
  const [diameter, setDiameter] = useState(diameterRatio);
  const ratios = wireRatios(length, diameter);

  return (
    <VisualCard
      onReset={() => {
        setLength(lengthRatio);
        setDiameter(diameterRatio);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.length}</span>}
            max={3}
            min={0.5}
            name={labels.lengthName}
            onValueChange={setLength}
            readout={<InlineMath math={quantity(length, "\\times", 1)} />}
            step={0.5}
            value={length}
          />
          <LabSlider
            label={<span>{labels.diameter}</span>}
            max={3}
            min={0.5}
            name={labels.diameterName}
            onValueChange={setDiameter}
            readout={<InlineMath math={quantity(diameter, "\\times", 1)} />}
            step={0.5}
            value={diameter}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.8} setting="lab">
          <Suspense fallback={null}>
            <WireResistanceScene diameter={diameter} length={length} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.resistance}
            value={
              <InlineMath
                math={`\\dfrac{R_2}{R_1}=${quantity(ratios.resistance, "", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={`\\dfrac{P_2}{P_1}=${quantity(ratios.power, "", 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
