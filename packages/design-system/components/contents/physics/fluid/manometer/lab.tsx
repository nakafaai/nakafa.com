import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { ManometerScene } from "@repo/design-system/components/contents/physics/fluid/manometer/scene";
import { manometer } from "@repo/design-system/components/contents/physics/fluid/pressure";
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

interface ManometerLabProps {
  /** The atmospheric pressure, in cm of the reference liquid. */
  atmosphere: number;
  description: NonNullable<ReactNode>;
  /** How much lower the liquid stands on the gas side at the start, in centimetres. */
  difference: number;
  labels: {
    difference: ReactNode;
    differenceName: string;
    excess: ReactNode;
    gas: ReactNode;
    viewLabel: string;
  };
  /** The density of the manometer liquid, in g cm⁻³. */
  liquidDensity: number;
  /** The density of the liquid the pressures are measured in, such as mercury, in g cm⁻³. */
  referenceDensity: number;
  title: NonNullable<ReactNode>;
}

/**
 * A U-tube manometer with one arm on a gas supply and the other open to the
 * air. The gas pushes its side down until the extra column on the open side
 * balances the extra pressure, so the gas pressure is the atmosphere's plus
 * that column, turned into the reference liquid by the ratio of densities.
 * Turn the gas up or down and watch both levels move.
 */
export function ManometerLab({
  atmosphere,
  description,
  difference: start,
  labels,
  liquidDensity,
  referenceDensity,
  title,
}: ManometerLabProps) {
  const quantity = useQuantity();
  const [difference, setDifference] = useState(start);
  const reading = manometer(
    difference,
    { liquid: liquidDensity, reference: referenceDensity },
    atmosphere
  );
  const most = Math.max(start * 1.5, 10);

  return (
    <VisualCard
      onReset={() => {
        setDifference(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.difference}</span>}
          max={Math.ceil(most)}
          min={0}
          name={labels.differenceName}
          onValueChange={setDifference}
          readout={<InlineMath math={quantity(difference, "\\text{ cm}", 1)} />}
          step={0.1}
          value={difference}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={3} setting="lab">
          <Suspense fallback={null}>
            <ManometerScene
              dense={liquidDensity > 5}
              difference={difference}
              most={most}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.excess}
            value={
              <InlineMath
                math={quantity(reading.excess, "\\text{ cm Hg}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.gas}
            value={
              <InlineMath math={quantity(reading.gas, "\\text{ cm Hg}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
