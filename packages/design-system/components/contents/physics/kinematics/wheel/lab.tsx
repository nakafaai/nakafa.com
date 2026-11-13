import { useFrame } from "@react-three/fiber";
import {
  REFLECTOR_RADIUS,
  type SpinPeriod,
  SpinPeriodSchema,
  spinAt,
  VALVE_RADIUS,
} from "@repo/design-system/components/contents/physics/kinematics/wheel/spin";
import {
  VectorArrow,
  type VectorArrowHandle,
} from "@repo/design-system/components/contents/physics/solid/arrow";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualScene,
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
import { type ReactNode, type Ref, Suspense, useRef, useState } from "react";
import { type Group, Vector3 } from "three";

/** How high the axle stands above the floor, in metres. */
const AXLE_HEIGHT = 0.42;

/** The number of spokes of the wheel. */
const SPOKES = 24;

/** Metres of arrow per m/s of speed, so the faster point gets the longer arrow. */
const ARROW_SCALE = 0.07;

/** How far the turning slows on screen: one turn of a 0.5 s wheel takes 2 s to watch. */
const SLOW_MOTION = 0.25;

interface WheelSceneProps {
  readonly period: SpinPeriod;
}

/** The fork, its base, and the axle the wheel turns on. */
function WheelStand() {
  return (
    <group>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[0.42, 0.024, 0.28]} />
        <meshStandardMaterial
          color={MATERIAL.lampPost}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      {Arr.map([-0.05, 0.05], (side) => (
        <mesh castShadow key={side} position={[0, AXLE_HEIGHT / 2, side]}>
          <cylinderGeometry args={[0.012, 0.016, AXLE_HEIGHT, 16]} />
          <meshStandardMaterial
            color={MATERIAL.chrome}
            metalness={1}
            roughness={0.25}
          />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, AXLE_HEIGHT, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.008, 0.008, 0.13, 12]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

/** The wheel: tyre, rim, hub, spokes, the orange valve on the rim and the teal reflector on a spoke. */
function Wheel({ ref }: { readonly ref: Ref<Group> }) {
  return (
    <group position={[0, AXLE_HEIGHT, 0]} ref={ref}>
      <mesh castShadow>
        <torusGeometry args={[VALVE_RADIUS + 0.018, 0.016, 20, 96]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.9} />
      </mesh>
      <mesh castShadow>
        <torusGeometry args={[VALVE_RADIUS, 0.009, 14, 96]} />
        <meshStandardMaterial
          color={MATERIAL.rimDark}
          metalness={0.9}
          roughness={0.3}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.07, 20]} />
        <meshStandardMaterial
          color={MATERIAL.hub}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      {Arr.makeBy(SPOKES, (index) => {
        const angle = (index / SPOKES) * Math.PI * 2;
        const middle = (VALVE_RADIUS + 0.022) / 2;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * middle,
              Math.sin(angle) * middle,
              index % 2 === 0 ? 0.012 : -0.012,
            ]}
            rotation={[0, 0, angle - Math.PI / 2]}
          >
            <cylinderGeometry
              args={[0.0011, 0.0011, VALVE_RADIUS - 0.022, 6]}
            />
            <meshStandardMaterial
              color={MATERIAL.chrome}
              metalness={1}
              roughness={0.2}
            />
          </mesh>
        );
      })}
      <mesh
        position={[VALVE_RADIUS - 0.012, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.03, 10]} />
        <meshStandardMaterial
          color={PLOT_COLORS.orange}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, REFLECTOR_RADIUS, 0.015]}>
        <boxGeometry args={[0.03, 0.05, 0.008]} />
        <meshStandardMaterial
          color={PLOT_COLORS.teal}
          emissive={PLOT_COLORS.teal}
          emissiveIntensity={0.35}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/**
 * The wheel turning at the chosen period, slowed down so the eye can follow,
 * with each marked point's velocity drawn tangent to its circle.
 */
function WheelScene({ period }: WheelSceneProps) {
  const playing = useVisualScene((card) => card.playing, false);
  const wheel = useRef<Group>(null);
  const angle = useRef(0);
  const valveArrow = useRef<VectorArrowHandle>(null);
  const reflectorArrow = useRef<VectorArrowHandle>(null);
  const from = useRef(new Vector3());
  const vector = useRef(new Vector3());

  useFrame((_, delta) => {
    if (playing) {
      angle.current +=
        spinAt(period, 1).angular * Math.min(delta, 0.1) * SLOW_MOTION;
    }
    wheel.current?.rotation.set(0, 0, angle.current);
    const place = (
      radius: number,
      offset: number,
      arrow: VectorArrowHandle | null
    ) => {
      const turn = angle.current + offset;
      const speed = spinAt(period, radius).speed * ARROW_SCALE;
      from.current.set(
        Math.cos(turn) * radius,
        AXLE_HEIGHT + Math.sin(turn) * radius,
        0.04
      );
      vector.current.set(-Math.sin(turn) * speed, Math.cos(turn) * speed, 0);
      arrow?.set(from.current, vector.current);
    };
    place(VALVE_RADIUS, 0, valveArrow.current);
    place(REFLECTOR_RADIUS, Math.PI / 2, reflectorArrow.current);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <WheelStand />
      <Wheel ref={wheel} />
      <VectorArrow color={PLOT_COLORS.orange} head={0.04} ref={valveArrow} />
      <VectorArrow color={PLOT_COLORS.teal} head={0.04} ref={reflectorArrow} />
    </group>
  );
}

interface BicycleWheelSpeedLabProps {
  description: ReactNode;
  labels: {
    angularSpeed: ReactNode;
    choosePeriod: string;
    reflectorSpeed: ReactNode;
    valveAcceleration: ReactNode;
    valveSpeed: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A bicycle wheel spinning on a stand, with its valve on the rim and a
 * reflector halfway out. Both turn through the same angle each second, so
 * they share one angular speed; the valve travels a circle twice as long,
 * so its speed, drawn as the longer arrow, is twice the reflector's.
 */
export function BicycleWheelSpeedLab({
  description,
  labels,
  title,
}: BicycleWheelSpeedLabProps) {
  const [period, setPeriod] = useState<SpinPeriod>(1);
  const quantity = useQuantity();
  const isPeriod = Schema.is(SpinPeriodSchema);
  const valve = spinAt(period, VALVE_RADIUS);
  const reflector = spinAt(period, REFLECTOR_RADIUS);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.choosePeriod}
          gridColumns="3"
          onValueChange={(value) => {
            const next = Number(value);
            if (isPeriod(next)) {
              setPeriod(next);
            }
          }}
          type="single"
          value={String(period)}
          variant="outline"
        >
          {Arr.map(SpinPeriodSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`T=${quantity(option, "\\text{ s}", 1)}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="studio">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.35, 0.72, 1.65]}
              cameraTarget={[0, AXLE_HEIGHT, 0]}
              fov={34}
              maxDistance={2.4}
              minDistance={0.6}
            />
            <WheelScene period={period} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.angularSpeed}
            value={
              <InlineMath math={quantity(valve.angular, "\\text{ rad/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.valveSpeed}
            value={
              <InlineMath math={quantity(valve.speed, "\\text{ m/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.reflectorSpeed}
            value={
              <InlineMath math={quantity(reflector.speed, "\\text{ m/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.valveAcceleration}
            value={
              <InlineMath
                math={quantity(valve.acceleration, "\\text{ m/s}^2", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
