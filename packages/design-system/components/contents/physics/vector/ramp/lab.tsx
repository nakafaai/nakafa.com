import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  BlockSchema,
  rampForces,
  slopeWork,
} from "@repo/design-system/components/contents/physics/vector/ramp/incline";
import { RampScene } from "@repo/design-system/components/contents/physics/vector/ramp/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

interface RampBlockComponentLabProps {
  /** The ramp angle the card starts at, in degrees. */
  angle: number;
  description: ReactNode;
  /** A distance down the slope, in metres; when given, the card reads the work the weight does over it. */
  distance?: number;
  /** The static friction coefficient between block and plank. */
  friction: number;
  labels: {
    along: ReactNode;
    angle: ReactNode;
    angleName: string;
    into: ReactNode;
    viewLabel: string;
    weight: ReactNode;
    work?: ReactNode;
  };
  /** The mass of the block, in kilograms. */
  mass: number;
  title: ReactNode;
}

/**
 * A wooden block on a pine plank hinged on a lab bench. The learner tilts
 * the plank: the block's weight splits into a part down the slope and a
 * part into it, and the block slides once the part down the slope beats
 * friction.
 */
export function RampBlockComponentLab({
  angle: start,
  description,
  distance,
  friction,
  labels,
  mass,
  title,
}: RampBlockComponentLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(start);
  const block = useMemo(
    () => Schema.decodeUnknownSync(BlockSchema)({ friction, mass }),
    [friction, mass]
  );
  const forces = rampForces(block, angle);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.angle}
          max={60}
          min={0}
          name={labels.angleName}
          onValueChange={setAngle}
          readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
          step={1}
          value={angle}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.8} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.1, 0.5, 1.5]}
              cameraTarget={[0, 0.16, 0]}
              fov={36}
              maxDistance={2.4}
              minDistance={0.5}
            />
            <RampScene angle={angle} block={block} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.weight}
            value={
              <InlineMath math={quantity(forces.weight, "\\text{ N}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.along}
            value={
              <InlineMath math={quantity(forces.along, "\\text{ N}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.into}
            value={<InlineMath math={quantity(forces.into, "\\text{ N}", 2)} />}
          />
          {distance === undefined || labels.work === undefined ? null : (
            <VisualFactTabular
              label={labels.work}
              value={
                <InlineMath
                  math={quantity(
                    slopeWork(block, angle, distance),
                    "\\text{ J}",
                    2
                  )}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
