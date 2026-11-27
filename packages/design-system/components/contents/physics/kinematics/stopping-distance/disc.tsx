import { TemperatureIcon } from "@hugeicons/core-free-icons";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  discTemperature,
  kineticEnergy,
  START_TEMPERATURE,
  temperatureRise,
  thermalColor,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/heat";
import type { Stop } from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import {
  brakingTime,
  stopSpeed,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import {
  BrakeCaliper,
  WHEEL,
  WheelRotor,
} from "@repo/design-system/components/contents/physics/kinematics/tyre";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { BackSide, MeshBasicMaterial, SRGBColorSpace } from "three";

/** The speeds the learner can brake from, as in the lesson's table. */
const SPEEDS = [10, 20, 30] as const;

/** The car brakes as hard as the lesson's car: 5 m/s². */
const DECELERATION = 5;

/** The hub turns 0.6 m above the workshop floor, on the test stand's axle. */
const HUB_HEIGHT = 0.6;

/** The stand's column rises 0.3 m behind the wheel's inner face. */
const STAND_DEPTH = -0.3;

/**
 * The wheel turns at a twentieth of its true rate, so the eye can follow
 * the spokes: at 72 km/h a real wheel turns nine times a second.
 */
const SPIN_SHOWN = 0.05;

/**
 * A front wheel seen up close while the car brakes to rest. The caliper
 * squeezes the pads onto the disc, and friction turns the car's kinetic
 * energy, ½mv², into heat in the brakes. The eye sees no change, so a thermal
 * camera view paints every part by its temperature: braking from twice the
 * speed warms the discs four times as much.
 */
export function BrakeHeatLab({
  description,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly chooseSpeed: string;
    readonly discTemperature: ReactNode;
    readonly kineticEnergy: ReactNode;
    readonly temperatureRise: ReactNode;
    readonly thermal: string;
    readonly viewLabel: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(20);
  const [thermal, setThermal] = useState(false);
  const quantity = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSpeed}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(SPEEDS, (each) => String(each) === value),
              setSpeed
            );
          }}
          type="single"
          value={String(speed)}
          variant="outline"
        >
          {Arr.map(SPEEDS, (each) => (
            <ToggleGroupItem key={each} value={String(each)}>
              <InlineMath math={quantity(each, UNIT.speed, 0)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ButtonGroup>
          <Button
            aria-pressed={thermal}
            onClick={() => setThermal((shown) => !shown)}
          >
            <HugeIcons icon={TemperatureIcon} />
            {labels.thermal}
          </Button>
        </ButtonGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.5} setting="studio">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.62, HUB_HEIGHT + 0.22, 1.25]}
              cameraTarget={[0, HUB_HEIGHT - 0.06, 0]}
              fov={36}
              maxDistance={2.6}
              minDistance={0.6}
            />
            <WheelScene speed={speed} thermal={thermal} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.kineticEnergy}
            value={
              <InlineMath
                math={quantity(kineticEnergy(speed) / 1000, UNIT.energy, 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.temperatureRise}
            value={
              <InlineMath
                math={quantity(temperatureRise(speed), "\\text{ K}")}
              />
            }
          />
          <VisualFactTabular
            label={labels.discTemperature}
            value={
              <InlineMath
                math={quantity(discTemperature(speed, 1), UNIT.temperature)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** How much of the disc's warming each part the thermal camera paints shares. */
const WARMING = { caliper: 0.35, disc: 1, rim: 0.12, tyre: 0.04 } as const;

/**
 * One flat material per part for the thermal camera: a colour from the
 * camera's palette, untouched by light or tone mapping, as a thermal image
 * is, because the camera sees only the heat a surface gives off.
 */
function useThermalPaint() {
  const heat = useMemo(
    () => Rec.map(WARMING, () => new MeshBasicMaterial({ toneMapped: false })),
    []
  );

  useEffect(
    () => () => {
      Arr.forEach(Rec.values(heat), (material) => material.dispose());
    },
    [heat]
  );

  return heat;
}

/**
 * The workshop's brake test stand the wheel turns on: a bolted steel floor
 * plate, a column behind the wheel, the axle stub that carries the hub, and
 * the knuckle the caliper bolts to.
 */
function TestStand() {
  return (
    <group>
      <RoundedBox
        args={[0.62, 0.03, 0.46]}
        castShadow
        position={[0, 0.015, STAND_DEPTH]}
        radius={0.008}
        receiveShadow
      >
        <SurfaceMaterial
          color={CAR_COLORS.hub}
          metalness={1}
          repeat={[3, 2]}
          roughness={0.55}
          surface="brushed"
        />
      </RoundedBox>
      {Arr.map(
        [
          [0.27, 0.19],
          [0.27, -0.19],
          [-0.27, 0.19],
          [-0.27, -0.19],
        ] as const,
        ([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0.036, STAND_DEPTH + z]}>
            <cylinderGeometry args={[0.014, 0.014, 0.012, 6]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.3} />
          </mesh>
        )
      )}
      <mesh castShadow position={[0, HUB_HEIGHT / 2, STAND_DEPTH]}>
        <cylinderGeometry args={[0.05, 0.06, HUB_HEIGHT, 32]} />
        <SurfaceMaterial
          color={CAR_COLORS.carPaintDark}
          repeat={[2, 2]}
          roughness={0.5}
          surface="paint"
        />
      </mesh>
      <mesh castShadow position={[0, 0.045, STAND_DEPTH]}>
        <cylinderGeometry args={[0.095, 0.105, 0.03, 32]} />
        <MetalMaterial color={CAR_COLORS.hub} roughness={0.5} />
      </mesh>
      <mesh
        castShadow
        position={[0, HUB_HEIGHT, STAND_DEPTH / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.032, 0.032, -STAND_DEPTH + 0.1, 24]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.28} />
      </mesh>
      <mesh
        castShadow
        position={[0, HUB_HEIGHT, STAND_DEPTH]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.085, 0.085, 0.12, 32]} />
        <MetalMaterial color={CAR_COLORS.hub} roughness={0.45} />
      </mesh>
      <RoundedBox
        args={[0.2, 0.22, 0.024]}
        castShadow
        position={[-0.09, HUB_HEIGHT + 0.07, -0.06]}
        radius={0.008}
      >
        <MetalMaterial color={CAR_COLORS.hub} roughness={0.6} />
      </RoundedBox>
    </group>
  );
}

/**
 * What the thermal camera sees around the wheel: the garage at the starting
 * temperature, one flat colour from the camera's palette in every direction,
 * so the warm parts stand out as they do in a thermal image.
 */
function ThermalSurround() {
  const [red, green, blue] = thermalColor(START_TEMPERATURE);
  return (
    <mesh position={[0, HUB_HEIGHT, 0]}>
      <sphereGeometry args={[4, 24, 12]} />
      <meshBasicMaterial
        color={[red, green, blue]}
        side={BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * The wheel, the disc and the caliper, run by the card's play clock: the
 * wheel slows from `speed` to rest at 5 m/s² while the disc warms.
 */
function WheelScene({
  speed,
  thermal,
}: {
  readonly speed: (typeof SPEEDS)[number];
  readonly thermal: boolean;
}) {
  const wheel = useRef<Group>(null);
  const turned = useRef(0);
  const heat = useThermalPaint();
  const paint = thermal ? heat : undefined;
  const stop = useMemo<Stop>(
    () => ({ deceleration: DECELERATION, reaction: 0, speed }),
    [speed]
  );
  const { advance, playing } = useTimeline(-0.8, brakingTime(stop));

  useFrame((_, delta) => {
    const time = advance(delta);
    const current = time < 0 ? speed : stopSpeed(stop, time);
    turned.current -= (current / WHEEL.radius) * SPIN_SHOWN * delta;
    wheel.current?.rotation.set(0, 0, turned.current);
    if (!thermal) {
      return;
    }
    const warmth =
      discTemperature(speed, Math.max(0, time) / brakingTime(stop)) -
      START_TEMPERATURE;
    Arr.forEach(Rec.toEntries(heat), ([name, material]) => {
      const [red, green, blue] = thermalColor(
        START_TEMPERATURE + warmth * WARMING[name]
      );
      material.color.setRGB(red, green, blue, SRGBColorSpace);
    });
  });

  return (
    <>
      <SimulationTicker running={playing} />
      {thermal ? <ThermalSurround /> : <TestStand />}
      <group position={[0, HUB_HEIGHT, 0]}>
        <group ref={wheel}>
          <WheelRotor paint={paint} />
        </group>
        <BrakeCaliper paint={paint} />
      </group>
    </>
  );
}
