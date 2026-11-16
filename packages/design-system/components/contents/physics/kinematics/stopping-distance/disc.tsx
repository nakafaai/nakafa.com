import { TemperatureIcon } from "@hugeicons/core-free-icons";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  SEDAN,
  TYRE_PROFILE,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  discTemperature,
  kineticEnergy,
  START_TEMPERATURE,
  temperatureRise,
  thermalColor,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/heat";
import {
  brakingTime,
  type Stop,
  stopSpeed,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Option, Record as Rec } from "effect";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackSide,
  DataTexture,
  type Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** The speeds the learner can brake from, as in the lesson's table. */
const SPEEDS = [10, 20, 30] as const;

/** The car brakes as hard as the lesson's car: 5 m/s². */
const DECELERATION = 5;

/** The disc sits inside the rim: 330 mm across, 28 mm thick. */
const DISC = { radius: 0.165, thickness: 0.028 } as const;

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
  readonly description: ReactNode;
  readonly labels: {
    readonly chooseSpeed: string;
    readonly discTemperature: ReactNode;
    readonly kineticEnergy: ReactNode;
    readonly temperatureRise: ReactNode;
    readonly thermal: string;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
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
              cameraPosition={[0.75, HUB_HEIGHT + 0.42, 1.05]}
              cameraTarget={[0, HUB_HEIGHT, 0]}
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

/** The parts the thermal camera paints, with their daylight look. */
const PARTS = {
  caliper: {
    color: MATERIAL.caliper,
    metalness: 0.2,
    roughness: 0.35,
    warming: 0.35,
  },
  disc: {
    color: MATERIAL.castIron,
    metalness: 0.9,
    roughness: 0.42,
    warming: 1,
  },
  rim: {
    color: MATERIAL.rimBright,
    metalness: 1,
    roughness: 0.2,
    warming: 0.12,
  },
  tyre: { color: MATERIAL.tyre, metalness: 0, roughness: 0.92, warming: 0.04 },
} as const;

/**
 * Two materials per part, made once. In daylight a part keeps its own
 * colour and gloss. Through the thermal camera it is one flat colour from
 * the camera's palette, untouched by light or tone mapping, as a thermal
 * image is: the camera sees only the heat a surface gives off.
 */
function usePartMaterials(thermal: boolean) {
  const tread = useMemo(createTread, []);
  const daylight = useMemo(
    () =>
      Rec.map(
        PARTS,
        (part, name) =>
          new MeshStandardMaterial({
            bumpMap: name === "tyre" ? tread : null,
            bumpScale: 3,
            color: part.color,
            metalness: part.metalness,
            roughness: part.roughness,
          })
      ),
    [tread]
  );
  const heat = useMemo(
    () => Rec.map(PARTS, () => new MeshBasicMaterial({ toneMapped: false })),
    []
  );

  useEffect(
    () => () => {
      tread.dispose();
      Arr.forEach(
        Arr.appendAll(Rec.values(daylight), Rec.values(heat)),
        (material) => material.dispose()
      );
    },
    [daylight, heat, tread]
  );

  return { heat, shown: thermal ? heat : daylight };
}

/**
 * The tread's relief as a bump map on the turned tyre: the lathe's texture
 * runs once around the tyre and once across its profile, whose middle third
 * is the tread. Four grooves run round it and a sipe crosses each of the 72
 * blocks; the shoulders and sidewalls stay smooth.
 */
function createTread() {
  const across = 64;
  const around = 8;
  const data = new Uint8Array(across * around * 4);
  for (let row = 0; row < across; row += 1) {
    const v = (row + 0.5) / across;
    const tread = v > 0.43 && v < 0.57;
    const groove =
      tread &&
      Math.abs(((v - 0.43) / 0.14) * 5 - Math.round(((v - 0.43) / 0.14) * 5)) <
        0.12;
    for (let column = 0; column < around; column += 1) {
      const sipe = tread && column === 0;
      const value = groove || sipe ? 0 : 255;
      data.set([value, value, value, 255], (row * around + column) * 4);
    }
  }
  const texture = new DataTexture(data, around, across);
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(72, 1);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The workshop's brake test stand the wheel turns on: a steel floor plate, a
 * column behind the wheel and the axle stub that carries the hub, with the
 * knuckle plate the caliper bolts to.
 */
function TestStand() {
  return (
    <group>
      <RoundedBox
        args={[0.56, 0.03, 0.42]}
        castShadow
        position={[0, 0.015, STAND_DEPTH]}
        radius={0.008}
        receiveShadow
      >
        <MetalMaterial color={MATERIAL.hub} roughness={0.55} />
      </RoundedBox>
      <mesh castShadow position={[0, HUB_HEIGHT / 2, STAND_DEPTH]}>
        <cylinderGeometry args={[0.045, 0.055, HUB_HEIGHT, 28]} />
        <MetalMaterial color={MATERIAL.hub} roughness={0.5} />
      </mesh>
      <mesh
        castShadow
        position={[0, HUB_HEIGHT, STAND_DEPTH / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, -STAND_DEPTH, 20]} />
        <MetalMaterial color={MATERIAL.chrome} roughness={0.3} />
      </mesh>
      <RoundedBox
        args={[0.16, 0.22, 0.02]}
        castShadow
        position={[-0.05, HUB_HEIGHT + 0.04, -0.035]}
        radius={0.006}
      >
        <MetalMaterial color={MATERIAL.hub} roughness={0.6} />
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
  const { heat: palette, shown: materials } = usePartMaterials(thermal);
  const stop = useMemo<Stop>(
    () => ({ deceleration: DECELERATION, reaction: 0, speed }),
    [speed]
  );
  const { advance, playing } = useTimeline(-0.8, brakingTime(stop));

  useFrame((_, delta) => {
    const time = advance(delta);
    const current = time < 0 ? speed : stopSpeed(stop, time);
    turned.current -= (current / SEDAN.wheelRadius) * SPIN_SHOWN * delta;
    wheel.current?.rotation.set(0, 0, turned.current);
    if (!thermal) {
      return;
    }
    const heat =
      discTemperature(speed, Math.max(0, time) / brakingTime(stop)) -
      START_TEMPERATURE;
    Arr.forEach(Rec.toEntries(palette), ([name, material]) => {
      const [red, green, blue] = thermalColor(
        START_TEMPERATURE + heat * PARTS[name].warming
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
          <mesh material={materials.disc} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[DISC.radius, DISC.radius, DISC.thickness, 64]}
            />
          </mesh>
          <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 40]} />
            <MetalMaterial color={MATERIAL.hub} roughness={0.5} />
          </mesh>
          <mesh
            material={materials.tyre}
            position={[0, 0, 0.09]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <latheGeometry args={[TYRE_PROFILE, 64]} />
          </mesh>
          <mesh material={materials.rim} position={[0, 0, 0.09]}>
            <torusGeometry args={[0.205, 0.016, 12, 72]} />
          </mesh>
          {Arr.map(Arr.range(0, 4), (spoke) => (
            <group key={spoke} rotation={[0, 0, (spoke * 2 * Math.PI) / 5]}>
              <mesh material={materials.rim} position={[0.11, 0, 0.12]}>
                <boxGeometry args={[0.19, 0.032, 0.02]} />
              </mesh>
            </group>
          ))}
        </group>
        <RoundedBox
          args={[0.11, 0.07, 0.07]}
          material={materials.caliper}
          position={[-0.11, 0.11, 0]}
          radius={0.012}
          rotation={[0, 0, Math.PI / 4]}
        />
      </group>
    </>
  );
}
