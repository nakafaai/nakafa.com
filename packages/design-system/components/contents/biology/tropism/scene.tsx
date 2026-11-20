import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import { BenchLamp } from "@repo/design-system/components/contents/biology/glassware";
import type {
  LightTreatment,
  TropismSetup,
} from "@repo/design-system/components/contents/biology/tropism/auxin";
import {
  gravitySplit,
  lightSplit,
} from "@repo/design-system/components/contents/biology/tropism/auxin";
import {
  organTip,
  SeedlingOrgan,
} from "@repo/design-system/components/contents/biology/tropism/seedling";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Vector2 } from "three";

/** How far apart the seedlings stand along the bench, in metres. */
const GAP = 0.085;

/** How far apart the cork boards stand, in metres. */
const BOARD_GAP = 0.17;

/** Where the row of seedlings starts on the bench, in metres. */
const ROW = [0.06, 0, 0.12] as const;

/** How many hours pass in a second while the card plays. */
const HOURS_PER_SECOND = 8;

/**
 * Seedlings in pots in a row, lit from the right by a bench lamp, each
 * treated as the lesson names, and growing over the run.
 */
export function LightScene({
  chosen,
  elapsed,
  hours,
  onElapsed,
  seedlings,
}: {
  readonly chosen: number;
  readonly elapsed: number;
  readonly hours: number;
  readonly onElapsed: (hours: number) => void;
  readonly seedlings: Extract<TropismSetup, { stimulus: "light" }>["seedlings"];
}) {
  useRunClock({
    elapsed,
    onElapsed,
    perSecond: HOURS_PER_SECOND,
    steps: 48,
    total: hours,
  });
  const progress = elapsed / hours;
  const lampX = ROW[0] + (seedlings.length - 1) * GAP + 0.16;
  return (
    <group>
      <TropismCamera count={seedlings.length} gap={GAP} />
      <LabBench />
      <group position={[lampX, 0, ROW[2]]}>
        <group rotation={[0, Math.PI, 0]}>
          <BenchLamp target={[lampX - ROW[0], 0.06, 0]} />
        </group>
      </group>
      {Arr.map(seedlings, (seedling, index) => {
        const split = lightSplit(seedling.treatment);
        return (
          <group
            key={seedling.name}
            position={[ROW[0] + index * GAP, 0, ROW[2]]}
          >
            <Pot />
            <group position={[0, 0.045, 0]}>
              <SeedlingOrgan
                cut={seedling.treatment === "cut"}
                heading={Math.PI / 2}
                organ="shoot"
                progress={progress}
                split={split}
              />
              <Treatment progress={progress} treatment={seedling.treatment} />
            </group>
            <PotTag chosen={index === chosen} name={seedling.name} />
          </group>
        );
      })}
    </group>
  );
}

/** The cap or the mica plate a treatment adds to an upright shoot. */
function Treatment({
  progress,
  treatment,
}: {
  readonly progress: number;
  readonly treatment: LightTreatment;
}) {
  const shape = organTip(Math.PI / 2, "shoot", progress, lightSplit(treatment));
  if (treatment === "cap") {
    return (
      <mesh
        position={[shape.tip[0], shape.tip[1] - 0.003, 0]}
        rotation={[0, 0, shape.heading - Math.PI / 2]}
      >
        <cylinderGeometry
          args={[shape.radius * 1.35, shape.radius * 1.35, 0.012, 18, 1]}
        />
        <MetalMaterial color={BIOLOGY_COLORS.foil} roughness={0.5} />
      </mesh>
    );
  }
  if (treatment === "micaShade" || treatment === "micaLit") {
    const side = treatment === "micaLit" ? 1 : -1;
    return (
      <mesh
        position={[
          shape.below[0] + side * shape.radius * 0.5,
          shape.below[1],
          0,
        ]}
      >
        <boxGeometry args={[shape.radius * 1.6, 0.0005, 0.012]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={BIOLOGY_COLORS.mica}
          metalness={0.2}
          opacity={0.75}
          roughness={0.15}
          transparent
        />
      </mesh>
    );
  }
  return null;
}

/**
 * Bean seedlings laid on their sides on a moist cork board in the dark, each
 * with a shoot to the right and a root to the left. A klinostat turns its
 * board slowly about its middle, so no side stays lower.
 */
export function GravityScene({
  chosen,
  elapsed,
  hours,
  onElapsed,
  seedlings,
}: {
  readonly chosen: number;
  readonly elapsed: number;
  readonly hours: number;
  readonly onElapsed: (hours: number) => void;
  readonly seedlings: Extract<
    TropismSetup,
    { stimulus: "gravity" }
  >["seedlings"];
}) {
  useRunClock({
    elapsed,
    onElapsed,
    perSecond: HOURS_PER_SECOND,
    steps: 48,
    total: hours,
  });
  const progress = elapsed / hours;
  return (
    <group>
      <TropismCamera count={seedlings.length} gap={BOARD_GAP} />
      <LabBench />
      {Arr.map(seedlings, (seedling, index) => (
        <group
          key={seedling.name}
          position={[ROW[0] + index * BOARD_GAP, 0, ROW[2]]}
        >
          <Board klinostat={seedling.treatment === "klinostat"}>
            <mesh scale={[1, 0.72, 0.6]}>
              <sphereGeometry args={[0.009, 20, 14]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.bean}
                roughness={0.5}
              />
            </mesh>
            <group position={[0.006, 0, 0]}>
              <SeedlingOrgan
                heading={0}
                organ="shoot"
                progress={progress}
                split={gravitySplit(seedling.treatment, "shoot")}
              />
            </group>
            <group position={[-0.006, 0, 0]}>
              <SeedlingOrgan
                cut={seedling.treatment === "decapped"}
                heading={Math.PI}
                organ="root"
                progress={progress}
                split={gravitySplit(seedling.treatment, "root")}
              />
            </group>
          </Board>
          <PotTag chosen={index === chosen} name={seedling.name} />
        </group>
      ))}
    </group>
  );
}

/** A cork board standing upright on a foot, turning slowly when it sits on a klinostat. */
function Board({
  children,
  klinostat,
}: {
  readonly children: ReactNode;
  readonly klinostat: boolean;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const disc = useRef<Group>(null);
  useFrame((state, delta) => {
    if (klinostat && playing && disc.current !== null) {
      disc.current.rotation.z += delta * 0.6;
      state.invalidate();
    }
  });
  return (
    <group position={[0, 0.09, 0]}>
      <mesh castShadow position={[0, -0.05, -0.012]}>
        <boxGeometry args={[0.03, 0.08, 0.012]} />
        <meshStandardMaterial
          color={klinostat ? BENCH_COLORS.meterBody : BIOLOGY_COLORS.blockWood}
          roughness={0.6}
        />
      </mesh>
      <group ref={disc}>
        <mesh
          castShadow
          position={[0, 0, -0.004]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.072, 0.072, 0.006, 48]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.cork} roughness={0.9} />
        </mesh>
        {children}
      </group>
    </group>
  );
}

/** A terracotta pot of moist soil, 6 cm across. */
function Pot() {
  const wall = useMemo(
    () => [
      new Vector2(0.02, 0),
      new Vector2(0.03, 0.045),
      new Vector2(0.033, 0.046),
      new Vector2(0.033, 0.05),
      new Vector2(0.029, 0.05),
    ],
    []
  );
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[wall, 36]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.terracotta}
          roughness={0.85}
        />
      </mesh>
      <mesh position={[0, 0.044, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0295, 36]} />
        <meshStandardMaterial color={ENERGY_COLORS.soil} roughness={1} />
      </mesh>
    </group>
  );
}

/** The letter a seedling goes by, in front of it; the chosen one stands out. */
function PotTag({
  chosen,
  name,
}: {
  readonly chosen: boolean;
  readonly name: string;
}) {
  const ink = useLabelInk();
  return (
    <ThreeLabel
      color={chosen ? BIOLOGY_COLORS.auxin : ink}
      fontSize="compact"
      position={[0, 0.012, 0.045]}
    >
      {name}
    </ThreeLabel>
  );
}

/** Looks along the row of `count` seedlings `gap` apart from the front and a little above, farther back for a longer row or a narrow card. */
function TropismCamera({
  count,
  gap,
}: {
  readonly count: number;
  readonly gap: number;
}) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const span = count * gap + 0.18;
  const distance = span * (narrow ? 1.55 : 0.95);
  const x = ROW[0] + ((count - 1) * gap) / 2;
  return (
    <CameraControls
      cameraPosition={[x, 0.08 + distance * 0.22, ROW[2] + distance]}
      cameraTarget={[x, 0.07, ROW[2]]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.12}
    />
  );
}
