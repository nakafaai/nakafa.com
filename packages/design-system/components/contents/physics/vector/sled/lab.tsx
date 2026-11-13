import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  TowSchema,
  towParts,
} from "@repo/design-system/components/contents/physics/vector/sled/pull";
import { SledScene } from "@repo/design-system/components/contents/physics/vector/sled/scene";
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

interface SledPullWorkLabProps {
  /** The rope angle above the snow the card starts at, in degrees. */
  angle: number;
  description: ReactNode;
  /** The distance the sled is pulled, in metres. */
  distance: number;
  /** The pull along the rope, in newtons. */
  force: number;
  labels: {
    along: ReactNode;
    angle: ReactNode;
    angleName: string;
    normal: ReactNode;
    up: ReactNode;
    viewLabel: string;
    work: ReactNode;
  };
  /** The mass of the sled and its load, in kilograms. */
  mass: number;
  title: ReactNode;
}

/**
 * A sled of firewood pulled across snow by a rope. The learner raises or
 * lowers the rope: the pull splits into a part along the snow and a part up,
 * the part up eases the sled's press on the snow, and only the part along
 * the motion does work over the distance.
 */
export function SledPullWorkLab({
  angle: start,
  description,
  distance,
  force,
  labels,
  mass,
  title,
}: SledPullWorkLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(start);
  const tow = useMemo(
    () => Schema.decodeSync(TowSchema)({ distance, force, mass }),
    [distance, force, mass]
  );
  const parts = towParts(tow, angle);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.angle}
          max={80}
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
        <ScienceStage floor={0} reach={2} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.35, 0.95, 2.6]}
              cameraTarget={[0.55, 0.35, 0]}
              fov={38}
              maxDistance={6}
              minDistance={1.2}
            />
            <SledScene angle={angle} tow={tow} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.along}
            value={<InlineMath math={quantity(parts.along, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.up}
            value={<InlineMath math={quantity(parts.up, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.normal}
            value={
              <InlineMath math={quantity(parts.normal, "\\text{ N}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.work}
            value={<InlineMath math={quantity(parts.work, "\\text{ J}", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
