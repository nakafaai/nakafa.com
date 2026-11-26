import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { SpinPeriod } from "@repo/design-system/components/contents/physics/kinematics/wheel/spin";
import {
  REFLECTOR_RADIUS,
  SpinPeriodSchema,
  spinAt,
  VALVE_RADIUS,
} from "@repo/design-system/components/contents/physics/kinematics/wheel/spin";
import type { VectorArrowHandle } from "@repo/design-system/components/contents/physics/solid/arrow";
import { VectorArrow } from "@repo/design-system/components/contents/physics/solid/arrow";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
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
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode, Ref } from "react";
import { Suspense, useRef, useState } from "react";
import type { Group } from "three";
import { Vector3 } from "three";

/** How high the axle stands above the floor, in metres. */
const AXLE_HEIGHT = 0.42;

/** The number of spokes of the wheel. */
const SPOKES = 24;

/** Metres of arrow per m/s of speed, so the faster point gets the longer arrow. */
const ARROW_SCALE = 0.07;

/** How far the turning slows on screen: one turn of a 0.5 s wheel takes 2 s to watch. */
const SLOW_MOTION = 0.25;

interface WheelSceneProps {
  readonly onReset: () => void;
  readonly period: SpinPeriod;
}

/** The fork, its chamfered cast-iron base, and the quick-release axle the wheel turns on. */
function WheelStand() {
  return (
    <group>
      <RoundedBox
        args={[0.44, 0.032, 0.3]}
        castShadow
        position={[0, 0.016, 0]}
        radius={0.008}
        receiveShadow
        smoothness={2}
      >
        <SurfaceMaterial
          color={ROAD_COLORS.lampPost}
          metalness={0.75}
          roughness={0.42}
          surface="brushed"
        />
      </RoundedBox>
      {Arr.map([-0.052, 0.052], (side) => (
        <group key={side}>
          <mesh castShadow position={[0, AXLE_HEIGHT / 2, side]}>
            <cylinderGeometry args={[0.012, 0.018, AXLE_HEIGHT, 20]} />
            <SurfaceMaterial
              color={CAR_COLORS.chrome}
              metalness={1}
              roughness={0.25}
              surface="brushed"
            />
          </mesh>
          <mesh
            castShadow
            position={[0, AXLE_HEIGHT, side * 1.35]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.014, 0.014, 0.016, 6]} />
            <SurfaceMaterial
              color={CAR_COLORS.castIron}
              metalness={0.9}
              roughness={0.35}
              surface="brushed"
            />
          </mesh>
        </group>
      ))}
      <mesh
        castShadow
        position={[0, AXLE_HEIGHT, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.009, 0.009, 0.15, 16]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.2}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}

/** The wheel: treaded rubber tyre, brushed alloy rim, flanged hub, spokes, valve and prismatic reflector. */
function Wheel({ ref }: { readonly ref: Ref<Group> }) {
  return (
    <group position={[0, AXLE_HEIGHT, 0]} ref={ref}>
      <mesh castShadow>
        <torusGeometry args={[VALVE_RADIUS + 0.018, 0.018, 24, 96]} />
        <SurfaceMaterial
          color={CAR_COLORS.tyre}
          repeat={[24, 2]}
          surface="rubber"
        />
      </mesh>
      <mesh castShadow>
        <torusGeometry args={[VALVE_RADIUS, 0.01, 16, 96]} />
        <SurfaceMaterial
          color={CAR_COLORS.rimBright}
          metalness={0.95}
          roughness={0.26}
          surface="brushed"
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.072, 24]} />
        <SurfaceMaterial
          color={CAR_COLORS.hub}
          metalness={0.9}
          roughness={0.32}
          surface="brushed"
        />
      </mesh>
      {Arr.map([-0.022, 0.022] as const, (fz) => (
        <mesh key={fz} position={[0, 0, fz]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.034, 0.034, 0.006, 24]} />
          <SurfaceMaterial
            color={CAR_COLORS.chrome}
            metalness={1}
            roughness={0.24}
            surface="brushed"
          />
        </mesh>
      ))}
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
              color={CAR_COLORS.chrome}
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
function WheelScene({ onReset, period }: WheelSceneProps) {
  const playing = useVisualScene((card) => card.playing, false);
  const wheel = useRef<Group>(null);
  const angle = useRef(0);
  const valveArrow = useRef<VectorArrowHandle>(null);
  const reflectorArrow = useRef<VectorArrowHandle>(null);
  const from = useRef(new Vector3());
  const vector = useRef(new Vector3());

  useVisualStop(() => {
    angle.current = 0;
  });
  useVisualReset(onReset);

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
  description: NonNullable<ReactNode>;
  labels: {
    angularSpeed: ReactNode;
    choosePeriod: string;
    reflectorSpeed: ReactNode;
    valveAcceleration: ReactNode;
    valveSpeed: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
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
            <WheelScene onReset={() => setPeriod(1)} period={period} />
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
