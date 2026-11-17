import { RoundedBox } from "@react-three/drei";
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
import {
  type Placement,
  Repeat,
} from "@repo/design-system/components/three/repeat";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
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
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { DoubleSide, LatheGeometry, Vector2 } from "three";

/** The height of the wheel's hub above the floor, in metres. */
const HUB = 0.34;

/** Metres of arrow per newton of force. */
const FORCE_SCALE = 0.0011;

/** Metres of arrow per N·m of torque. */
const TORQUE_SCALE = 0.0035;

/** A tyre's section from bead to bead: the sidewalls bulge out to rounded shoulders and a flat tread, in metres from the axle. */
const TYRE_SECTION = [
  [0.214, -0.085],
  [0.24, -0.098],
  [0.29, -0.102],
  [0.326, -0.094],
  [0.342, -0.074],
  [0.346, -0.04],
  [0.346, 0.04],
  [0.342, 0.074],
  [0.326, 0.094],
  [0.29, 0.102],
  [0.24, 0.098],
  [0.214, 0.085],
] as const;

/** The three circumferential grooves cut round the tread. */
const GROOVES = [-0.045, 0, 0.045] as const;

/** The alloy rim's five spokes, from the hub out to the lip. */
const SPOKES: readonly Placement[] = Arr.makeBy(5, (index) => {
  const turn = (index / 5) * Math.PI * 2 + Math.PI / 2;
  return {
    position: [Math.cos(turn) * 0.135, Math.sin(turn) * 0.135, 0.062],
    rotation: [0, 0, turn],
  };
});

/** The five hexagon lug nuts round the hub. */
const LUGS: readonly Placement[] = Arr.makeBy(5, (index) => {
  const turn = (index / 5) * Math.PI * 2 + Math.PI / 2 + Math.PI / 5;
  return {
    position: [Math.cos(turn) * 0.1, Math.sin(turn) * 0.1, 0.082],
    rotation: [Math.PI / 2, 0, 0],
  };
});

/**
 * A car wheel facing +z: a tyre lathed from its section with three grooves
 * round its tread, a five-spoke alloy rim with its lip and the barrel
 * behind, the brake disc and red caliper seen between the spokes, the
 * centre cap, and five hexagon lug nuts.
 */
function Wheel() {
  const tyre = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(TYRE_SECTION, ([radius, depth]) => new Vector2(radius, depth)),
        96
      ),
    []
  );
  useEffect(() => () => tyre.dispose(), [tyre]);

  return (
    <group position={[0, HUB, 0]}>
      <mesh
        castShadow
        geometry={tyre}
        receiveShadow
        rotation={[Math.PI / 2, 0, 0]}
      >
        <SurfaceMaterial
          color={CAR_COLORS.tyre}
          repeat={[24, 1]}
          surface="rubber"
        />
      </mesh>
      {Arr.map(GROOVES, (depth) => (
        <mesh key={depth} position={[0, 0, depth]}>
          <torusGeometry args={[0.3462, 0.0045, 6, 96]} />
          <meshStandardMaterial color={ROAD_COLORS.skidRubber} roughness={1} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.212, 0.212, 0.17, 64, 1, true]} />
        <SurfaceMaterial
          color={CAR_COLORS.hub}
          metalness={1}
          roughness={0.6}
          side={DoubleSide}
          surface="brushed"
        />
      </mesh>
      <mesh position={[0, 0, 0.068]}>
        <torusGeometry args={[0.206, 0.012, 12, 96]} />
        <SurfaceMaterial
          color={CAR_COLORS.rimBright}
          metalness={1}
          roughness={0.35}
          surface="brushed"
        />
      </mesh>
      <Repeat placements={SPOKES}>
        <boxGeometry args={[0.15, 0.034, 0.02]} />
        <SurfaceMaterial
          color={CAR_COLORS.rimBright}
          metalness={1}
          roughness={0.55}
          surface="brushed"
        />
      </Repeat>
      <mesh position={[0, 0, 0.066]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.08, 0.025, 48]} />
        <SurfaceMaterial
          color={CAR_COLORS.rimBright}
          metalness={1}
          roughness={0.35}
          surface="brushed"
        />
      </mesh>
      <mesh position={[0, 0, 0.082]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.032, 0.012, 32]} />
        <SurfaceMaterial
          color={CAR_COLORS.hub}
          metalness={1}
          roughness={0.4}
          surface="brushed"
        />
      </mesh>
      <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.165, 0.165, 0.022, 64]} />
        <SurfaceMaterial
          color={CAR_COLORS.castIron}
          metalness={1}
          roughness={0.55}
          surface="brushed"
        />
      </mesh>
      <RoundedBox
        args={[0.09, 0.07, 0.05]}
        position={[0.12, -0.08, 0.005]}
        radius={0.01}
        rotation={[0, 0, 0.6]}
        smoothness={2}
      >
        <SurfaceMaterial color={CAR_COLORS.caliper} surface="paint" />
      </RoundedBox>
      <Repeat placements={LUGS}>
        <cylinderGeometry args={[0.014, 0.014, 0.022, 6]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.3}
          surface="brushed"
        />
      </Repeat>
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
      <mesh castShadow position={[nut[0], nut[1], 0.112]}>
        <torusGeometry args={[0.026, 0.009, 12, 24]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.25}
          surface="brushed"
        />
      </mesh>
      <mesh
        castShadow
        position={[nut[0], nut[1], 0.1]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.017, 0.017, 0.03, 6]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <RoundedBox
        args={[grip.arm + 0.1, 0.022, 0.012]}
        castShadow
        position={[nut[0] + grip.arm / 2 + 0.06, nut[1], 0.112]}
        radius={0.005}
        smoothness={3}
      >
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.25}
          surface="brushed"
        />
      </RoundedBox>
      <RoundedBox
        args={[0.13, 0.034, 0.026]}
        castShadow
        position={[nut[0] + grip.arm + 0.04, nut[1], 0.112]}
        radius={0.012}
        smoothness={3}
      >
        <SurfaceMaterial color={MACHINE_COLORS.gripRed} surface="rubber" />
      </RoundedBox>
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
  description: NonNullable<ReactNode>;
  /** The force of the hand, in newtons. */
  force: number;
  labels: {
    angle: ReactNode;
    angleName: string;
    square: ReactNode;
    torque: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
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
