import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  BrakeCaliper,
  WHEEL,
  WheelRotor,
} from "@repo/design-system/components/contents/physics/kinematics/tyre";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import type { Grip } from "@repo/design-system/components/contents/physics/vector/wrench/torque";
import {
  GripSchema,
  wrenchTorque,
} from "@repo/design-system/components/contents/physics/vector/wrench/torque";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** The height of the wheel's hub above the floor, in metres. */
const HUB = WHEEL.radius;

/** Metres of arrow per newton of force. */
const FORCE_SCALE = 0.0011;

/** Metres of arrow per N·m of torque. */
const TORQUE_SCALE = 0.0035;

/** Where the breaker bar runs, clear of the tyre's sidewall, in metres from the wheel's middle. */
const BAR = WHEEL.width / 2 + 0.03;

/** The nut the socket sits on: the top one of the five, on the wheel's face. */
const NUT = [0, HUB + WHEEL.lugCircle, WHEEL.face + 0.02] as const;

/**
 * A car wheel facing +z, standing on the floor: the shared road wheel with
 * its brake behind the spokes, turned so one of its five nuts is at the top.
 */
function Wheel() {
  return (
    <group position={[0, HUB, 0]}>
      <group rotation={[0, 0, -Math.PI / 5]}>
        <WheelRotor />
      </group>
      <BrakeCaliper />
    </group>
  );
}

/** Drop-forged chrome-vanadium steel, satin on the forging and bright where it is machined. */
function ChromeVanadium({ roughness }: { readonly roughness: number }) {
  return (
    <SurfaceMaterial
      bump={0.2}
      color={CAR_COLORS.chrome}
      metalness={1}
      repeat={[1, 6]}
      roughness={roughness}
      surface="brushed"
    />
  );
}

/**
 * A breaker bar on the top nut: a deep six-point socket that reaches past the
 * tyre's sidewall, the forged head it pivots in, the bar out to a grip of
 * `arm` metres, and the ribbed handle the hand pushes on.
 */
function BreakerBar({ arm }: { readonly arm: number }) {
  return (
    <group position={[NUT[0], NUT[1], 0]}>
      <mesh
        castShadow
        position={[0, 0, (NUT[2] + BAR) / 2 - 0.006]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.0165, 0.0175, BAR - NUT[2] + 0.012, 24]} />
        <ChromeVanadium roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0, BAR]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.024, 32]} />
        <ChromeVanadium roughness={0.22} />
      </mesh>
      <RoundedBox
        args={[0.07, 0.03, 0.02]}
        castShadow
        position={[0.03, 0, BAR]}
        radius={0.008}
        smoothness={3}
      >
        <ChromeVanadium roughness={0.3} />
      </RoundedBox>
      <mesh
        castShadow
        position={[arm / 2 + 0.01, 0, BAR]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0075, 0.0095, arm - 0.1, 20]} />
        <ChromeVanadium roughness={0.2} />
      </mesh>
      <mesh
        castShadow
        position={[arm + 0.005, 0, BAR]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <capsuleGeometry args={[0.0145, 0.11, 8, 20]} />
        <SurfaceMaterial
          bump={1}
          color={MACHINE_COLORS.gripRed}
          repeat={[2, 6]}
          surface="rubber"
        />
      </mesh>
      {Arr.map(Arr.range(0, 5), (rib) => (
        <mesh
          key={rib}
          position={[arm - 0.04 + rib * 0.018, 0, BAR]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[0.0148, 0.0018, 6, 20]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.9} />
        </mesh>
      ))}
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
  const nut = NUT;
  const hand = [
    nut[0] + grip.arm,
    nut[1],
    BAR + 0.02,
  ] satisfies CoordinateTuple;
  const parts = wrenchTorque(grip, angle);
  const force = [
    Math.cos(turn) * grip.force * FORCE_SCALE,
    Math.sin(turn) * grip.force * FORCE_SCALE,
    0,
  ] satisfies CoordinateTuple;

  return (
    <group>
      <Wheel />
      <BreakerBar arm={grip.arm} />
      <FixedArrow
        color={PLOT_COLORS.slate}
        from={[nut[0], nut[1], BAR + 0.035]}
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
        from={[hand[0], hand[1], BAR + 0.03]}
        head={0.03}
        thickness={0.004}
        vector={[0, force[1], 0]}
      />
      <FixedArrow
        color={PLOT_COLORS.violet}
        from={[nut[0], nut[1], BAR + 0.02]}
        head={0.04}
        thickness={0.007}
        vector={[0, 0, parts.torque * TORQUE_SCALE]}
      />
      <ThreeLabel
        color={PLOT_COLORS.slate}
        fontSize="reading"
        position={[nut[0] + grip.arm / 2, nut[1] - 0.05, BAR + 0.035]}
      >
        <InlineMath math="\vec r" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="reading"
        position={[
          hand[0] + force[0] * 1.15,
          hand[1] + force[1] * 1.15,
          BAR + 0.02,
        ]}
      >
        <InlineMath math="\vec F" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.violet}
        fontSize="reading"
        position={[
          nut[0] - 0.05,
          nut[1] + 0.04,
          BAR + 0.02 + parts.torque * TORQUE_SCALE,
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
/**
 * Frames the wheel and the bar. A narrow frame is as wide as it is tall, so
 * its camera stands further back to keep the whole tyre in.
 */
function WrenchCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.74, 0.95, 1.85] : [0.55, 0.75, 1.25]}
      cameraTarget={[0.22, HUB + 0.08, 0.05]}
      fov={36}
      maxDistance={3.2}
      minDistance={0.5}
    />
  );
}

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
            <WrenchCamera />
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
