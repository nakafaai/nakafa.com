import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { TankScene } from "@repo/design-system/components/contents/physics/waves/tank/scene";
import { refractWave } from "@repo/design-system/components/contents/physics/waves/wave";
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

interface RippleTankLabProps {
  /** The wave speed in the deep water, in centimetres per second. */
  deepSpeed: number;
  description: NonNullable<ReactNode>;
  /** The angle of incidence the wave starts at, in degrees. */
  incidence: number;
  labels: {
    frequency: ReactNode;
    incidence: ReactNode;
    incidenceName: string;
    refraction: ReactNode;
    viewLabel: string;
    wavelength: ReactNode;
  };
  /** The wave speed in the shallow water, in centimetres per second. */
  shallowSpeed: number;
  title: NonNullable<ReactNode>;
  /** The wavelength in the deep water, in centimetres. */
  wavelength: number;
}

/**
 * A real ripple tank on its legs, with a glass plate under one half that
 * makes the water shallow. Straight crests cross from deep to shallow water:
 * the dipper keeps their frequency, so where they slow down they close up to
 * a shorter wavelength and turn toward the normal. Tilt the dipper and watch
 * both angles change.
 */
export function RippleTankLab({
  deepSpeed,
  description,
  incidence: start,
  labels,
  shallowSpeed,
  title,
  wavelength,
}: RippleTankLabProps) {
  const quantity = useQuantity();
  const [incidence, setIncidence] = useState(start);
  const shallow = refractWave(
    { incidence, speed: deepSpeed, wavelength },
    shallowSpeed
  );

  return (
    <VisualCard
      onReset={() => {
        setIncidence(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.incidence}</span>}
          max={70}
          min={0}
          name={labels.incidenceName}
          onValueChange={setIncidence}
          readout={<InlineMath math={quantity(incidence, "^\\circ", 0)} />}
          step={1}
          value={incidence}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={4} setting="lab">
          <Suspense fallback={null}>
            <TankScene
              deep={deepSpeed}
              incidence={incidence}
              shallow={shallowSpeed}
              wavelength={wavelength}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.frequency}
            value={
              <InlineMath
                math={quantity(shallow.frequency, "\\text{ Hz}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.wavelength}
            value={
              <InlineMath
                math={quantity(shallow.wavelength, "\\text{ cm}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.refraction}
            value={
              <InlineMath math={quantity(shallow.refraction, "^\\circ", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
