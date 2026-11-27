import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { HydraulicJackScene } from "@repo/design-system/components/contents/physics/fluid/jack/scene";
import { hydraulicJack } from "@repo/design-system/components/contents/physics/fluid/pressure";
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

interface HydraulicJackLabProps {
  description: NonNullable<ReactNode>;
  /** The force pushing down on the small piston, in newtons. */
  force: number;
  labels: {
    force: ReactNode;
    forceName: string;
    lifted: ReactNode;
    mass: ReactNode;
    pressure: ReactNode;
    rise: ReactNode;
    viewLabel: string;
  };
  /** The cross-sectional area of the large piston, in m². */
  largeArea: number;
  /** The cross-sectional area of the small piston, in m². */
  smallArea: number;
  /** How far the small piston is pushed down, in centimetres. */
  stroke: number;
  title: NonNullable<ReactNode>;
}

/**
 * A hydraulic jack in section, each cylinder drawn as wide as its piston.
 * Push the small piston down: the pressure it makes spreads unchanged through
 * the oil, so the large piston feels it over its whole area and lifts a far
 * heavier load, while the oil it moves spreads over that area and lifts the
 * load only a little way.
 */
export function HydraulicJackLab({
  description,
  force: start,
  labels,
  largeArea,
  smallArea,
  stroke,
  title,
}: HydraulicJackLabProps) {
  const quantity = useQuantity();
  const [force, setForce] = useState(start);
  const jack = hydraulicJack({
    force,
    large: largeArea,
    small: smallArea,
    stroke,
  });

  return (
    <VisualCard
      onReset={() => {
        setForce(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.force}</span>}
          max={Math.max(300, start * 2)}
          min={10}
          name={labels.forceName}
          onValueChange={setForce}
          readout={<InlineMath math={quantity(force, "\\text{ N}", 0)} />}
          step={10}
          value={force}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={3} setting="lab">
          <Suspense fallback={null}>
            <HydraulicJackScene
              force={force}
              gauge={force / Math.max(300, start * 2)}
              lifted={jack.lifted}
              pressure={jack.pressure}
              ratio={smallArea / largeArea}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.pressure}
            value={
              <InlineMath math={quantity(jack.pressure, "\\text{ Pa}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.lifted}
            value={<InlineMath math={quantity(jack.lifted, "\\text{ N}", 0)} />}
          />
          <VisualFactTabular
            label={labels.mass}
            value={<InlineMath math={quantity(jack.mass, "\\text{ kg}", 0)} />}
          />
          <VisualFactTabular
            label={labels.rise}
            value={<InlineMath math={quantity(jack.rise, "\\text{ cm}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
