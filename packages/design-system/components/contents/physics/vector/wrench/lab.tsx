import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import {
  type Grip,
  GripSchema,
  wrenchTorque,
} from "@repo/design-system/components/contents/physics/vector/wrench/torque";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

/** The height of the wheel's hub above the floor, in metres. */
const HUB = 0.34;

/** Metres of arrow per newton of force. */
const FORCE_SCALE = 0.0011;

/** Metres of arrow per N·m of torque. */
const TORQUE_SCALE = 0.0035;

/** The wheel: tyre, steel rim, and five lug nuts around the hub. */
function Wheel() {
  return (
    <group position={[0, HUB, 0]}>
      <mesh castShadow>
        <torusGeometry args={[0.27, 0.075, 24, 72]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.9} />
      </mesh>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.215, 0.215, 0.14, 64]} />
        <meshStandardMaterial
          color={MATERIAL.rimBright}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0, 0.072]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.01, 32]} />
        <meshStandardMaterial
          color={MATERIAL.hub}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      {Arr.makeBy(5, (index) => {
        const turn = (index / 5) * Math.PI * 2 + Math.PI / 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(turn) * 0.1, Math.sin(turn) * 0.1, 0.085]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.016, 0.016, 0.025, 6]} />
            <meshStandardMaterial
              color={MATERIAL.chrome}
              metalness={1}
              roughness={0.25}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** The wrench on the top-right nut, its arm out to the grip, the force at the grip, its square part, and the torque along the axis. */
function WrenchScene({
  angle,
  grip,
}: {
  readonly angle: number;
  readonly grip: Grip;
}) {
  const turn = (angle * Math.PI) / 180;
  const nut = [0, HUB + 0.1, 0.1] satisfies CoordinateTuple;
  const hand = [nut[0] + grip.arm, nut[1], 0.13] satisfies CoordinateTuple;
  const parts = wrenchTorque(grip, angle);
  const force = [
    Math.cos(turn) * grip.force * FORCE_SCALE,
    Math.sin(turn) * grip.force * FORCE_SCALE,
    0,
  ] satisfies CoordinateTuple;

  return (
    <group>
      <Wheel />
      <mesh
        castShadow
        position={[nut[0], nut[1], 0.115]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.024, 0.024, 0.05, 20]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.2}
        />
      </mesh>
      <mesh castShadow position={[nut[0] + grip.arm / 2 + 0.06, nut[1], 0.13]}>
        <boxGeometry args={[grip.arm + 0.16, 0.024, 0.016]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.22}
        />
      </mesh>
      <mesh castShadow position={[nut[0] + grip.arm + 0.04, nut[1], 0.13]}>
        <boxGeometry args={[0.12, 0.036, 0.03]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.8} />
      </mesh>
      <FixedArrow
        color={PLOT_COLORS.slate}
        from={[nut[0], nut[1], 0.16]}
        head={0.03}
        thickness={0.004}
        vector={[grip.arm, 0, 0]}
      />
      <FixedArrow
        color={PLOT_COLORS.amber}
        from={hand}
        head={0.035}
        thickness={0.005}
        vector={force}
      />
      <FixedArrow
        color={PLOT_COLORS.teal}
        from={[hand[0], hand[1], 0.14]}
        head={0.03}
        thickness={0.004}
        vector={[0, force[1], 0]}
      />
      <FixedArrow
        color={PLOT_COLORS.violet}
        from={[nut[0], nut[1], 0.14]}
        head={0.04}
        thickness={0.007}
        vector={[0, 0, parts.torque * TORQUE_SCALE]}
      />
      <ThreeLabel
        color={PLOT_COLORS.slate}
        fontSize="reading"
        position={[nut[0] + grip.arm / 2, nut[1] - 0.05, 0.16]}
      >
        <InlineMath math="\vec r" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="reading"
        position={[hand[0] + force[0] * 1.15, hand[1] + force[1] * 1.15, 0.13]}
      >
        <InlineMath math="\vec F" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.violet}
        fontSize="reading"
        position={[
          nut[0] - 0.05,
          nut[1] + 0.04,
          0.14 + parts.torque * TORQUE_SCALE,
        ]}
      >
        <InlineMath math="\vec\tau" />
      </ThreeLabel>
    </group>
  );
}

interface WrenchTorqueLabProps {
  /** The angle from the handle to the force the card starts at, in degrees. */
  angle: number;
  /** The grip's distance from the nut, in metres. */
  arm: number;
  description: ReactNode;
  /** The force of the hand, in newtons. */
  force: number;
  labels: {
    angle: ReactNode;
    angleName: string;
    square: ReactNode;
    torque: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A wheel brace on a car wheel's nut. The learner turns the direction of
 * the hand's force: the torque is the cross product of the arm and the
 * force, r F sin θ along the nut's axis, largest square to the handle and
 * zero along it, and it flips direction when the force crosses the handle.
 */
export function WrenchTorqueLab({
  angle: start,
  arm,
  description,
  force,
  labels,
  title,
}: WrenchTorqueLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(start);
  const grip = useMemo(
    () => Schema.decodeSync(GripSchema)({ arm, force }),
    [arm, force]
  );
  const parts = wrenchTorque(grip, angle);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.angle}
          max={180}
          min={-180}
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
        <ScienceStage floor={0} reach={0.9} setting="studio">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.55, 0.75, 1.25]}
              cameraTarget={[0.22, HUB + 0.08, 0.05]}
              fov={36}
              maxDistance={2.4}
              minDistance={0.5}
            />
            <WrenchScene angle={angle} grip={grip} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.square}
            value={
              <InlineMath math={quantity(parts.square, "\\text{ N}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.torque}
            value={
              <InlineMath
                math={quantity(parts.torque, "\\text{ N}\\cdot\\text{m}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
