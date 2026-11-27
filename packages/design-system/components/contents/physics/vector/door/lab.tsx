import { DoorScene } from "@repo/design-system/components/contents/physics/vector/door/scene";
import {
  DoorSchema,
  doorTorque,
} from "@repo/design-system/components/contents/physics/vector/door/swing";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

interface DoorHingeTorqueLabProps {
  /** The angle between the door and the push the card starts at, in degrees. */
  angle: number;
  /** The distance of the hand from the hinge the card starts at, in metres. */
  arm: number;
  description: NonNullable<ReactNode>;
  /** The push, in newtons. */
  force: number;
  labels: {
    angle: ReactNode;
    angleName: string;
    arm: ReactNode;
    armName: string;
    square: ReactNode;
    torque: ReactNode;
    viewLabel: string;
  };
  /** The mass of the door, in kilograms. */
  mass: number;
  title: NonNullable<ReactNode>;
  /** The width of the door, in metres. */
  width: number;
}

/**
 * A door in its wall, pushed open by a hand. The learner moves the hand
 * along the door and turns the push: the torque is the cross product r × F,
 * r F sin θ, so a push far from the hinge and square to the door swings it
 * open fastest, and a push along the door does nothing.
 */
export function DoorHingeTorqueLab({
  angle: startAngle,
  arm: startArm,
  description,
  force,
  labels,
  mass,
  title,
  width,
}: DoorHingeTorqueLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(startAngle);
  const [arm, setArm] = useState(startArm);
  const door = useMemo(
    () => Schema.decodeSync(DoorSchema)({ force, mass, width }),
    [force, mass, width]
  );
  const push = doorTorque(door, arm, angle);

  return (
    <VisualCard
      onReset={() => {
        setAngle(startAngle);
        setArm(startArm);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <VisualSlider
            heading={labels.arm}
            label={labels.armName}
            max={width}
            min={0.1}
            onValueChange={setArm}
            readout={<InlineMath math={quantity(arm, "\\text{ m}", 2)} />}
            step={0.05}
            value={arm}
          />
          <VisualSlider
            heading={labels.angle}
            label={labels.angleName}
            max={180}
            min={0}
            onValueChange={setAngle}
            readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
            step={1}
            value={angle}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="concrete" reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[2.7, 2.1, 3.5]}
              cameraTarget={[0.4, 1.1, 0]}
              fov={38}
              framing="content"
              maxDistance={7}
              minDistance={1.4}
            />
            <DoorScene angle={angle} arm={arm} door={door} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.square}
            value={<InlineMath math={quantity(push.square, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.torque}
            value={
              <InlineMath
                math={quantity(push.torque, "\\text{ N}\\cdot\\text{m}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
