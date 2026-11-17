import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { GlassTube } from "@repo/design-system/components/contents/biology/glassware";
import {
  lengthAfter,
  protoplastFill,
  type Strip,
} from "@repo/design-system/components/contents/biology/osmosis/tissue";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** How far apart the tubes stand in the rack, in metres. */
const GAP = 0.05;

/** A boiling tube's outer radius and height, in metres. */
const TUBE = { height: 0.15, radius: 0.0115 } as const;

/** How long each potato strip is cut before it soaks, in metres. */
const STRIP = 0.05;

/** How high the rack holds the tubes' feet above the bench, in metres. */
const FOOT = 0.012;

/** Where the magnified cell floats, in metres. */
const CELL = [0.27, 0.105, 0.1] as const;

/**
 * A rack of boiling tubes of sucrose solution, each holding a potato strip
 * that has swollen or shrunk by its tube's change in mass, and beside it one
 * potato cell drawn many times larger at the concentration the learner picks:
 * turgid in a weak solution, its protoplast pulling away from the wall in a
 * strong one.
 */
export function OsmosisScene({
  change,
  chosen,
  strips,
}: {
  readonly change: number;
  readonly chosen: number;
  readonly strips: readonly Strip[];
}) {
  const quantity = useQuantity();
  const ink = useLabelInk();
  const width = (strips.length - 1) * GAP;
  return (
    <group>
      <OsmosisCamera width={width} />
      <LabBench />
      <group position={[0.06, 0, 0.1]}>
        <Rack width={width} />
        {Arr.map(strips, (strip, index) => (
          <group
            key={strip.concentration}
            position={[index * GAP - width / 2, 0, 0]}
          >
            <GlassTube
              end={[0, FOOT + TUBE.height, 0]}
              opacity={0.14}
              radius={TUBE.radius}
              start={[0, FOOT + 0.01, 0]}
            />
            <mesh position={[0, FOOT + 0.01, 0]} rotation={[Math.PI, 0, 0]}>
              <sphereGeometry
                args={[TUBE.radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <GlassMaterial color={BENCH_COLORS.glass} opacity={0.3} />
            </mesh>
            <mesh position={[0, FOOT + 0.055, 0]}>
              <cylinderGeometry
                args={[TUBE.radius - 0.0012, TUBE.radius - 0.0012, 0.09, 24]}
              />
              <LiquidMaterial
                color={BIOLOGY_COLORS.sucrose}
                opacity={0.08 + strip.concentration * 0.25}
              />
            </mesh>
            <mesh
              castShadow
              position={[
                0,
                FOOT + 0.012 + lengthAfter(STRIP, strip.change) / 2,
                0,
              ]}
            >
              <boxGeometry
                args={[0.008, lengthAfter(STRIP, strip.change), 0.008]}
              />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.potato}
                roughness={0.75}
              />
            </mesh>
            {/* Every other tube's value hangs a row lower, so neighbouring
                values stand two tubes apart and read clearly on a phone. */}
            <ThreeLabel
              anchorY={index % 2 === 0 ? "bottom" : "top"}
              color={index === chosen ? BIOLOGY_COLORS.auxin : ink}
              fontSize="compact"
              gap={0.002}
              position={[0, 0.006, 0.05]}
            >
              <InlineMath math={quantity(strip.concentration, "", 2)} />
            </ThreeLabel>
          </group>
        ))}
      </group>
      <Cell fill={protoplastFill(change)} />
    </group>
  );
}

/** A wooden rack: a foot, a pierced shelf that holds the tubes, and two end posts. */
function Rack({ width }: { readonly width: number }) {
  const length = width + 0.06;
  return (
    <group>
      <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[length, 0.01, 0.05]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.blockWood}
          roughness={0.75}
        />
      </mesh>
      <mesh castShadow position={[0, 0.09, 0]}>
        <boxGeometry args={[length, 0.008, 0.05]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.blockWood}
          roughness={0.75}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * (length / 2 - 0.005), 0.05, 0]}
        >
          <boxGeometry args={[0.01, 0.09, 0.05]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.blockWood}
            roughness={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One potato cell drawn many times larger: its wall, the protoplast lining it
 * and the sap vacuole inside, with starch grains in the cytoplasm. It turns
 * slowly while the card plays.
 */
function Cell({ fill }: { readonly fill: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const group = useRef<Group>(null);
  const protoplast = useRef<Group>(null);
  const shown = useRef(fill);
  useFrame((state, delta) => {
    const current = group.current;
    if (current === null) {
      return;
    }
    if (playing) {
      current.rotation.y += simulationStep(delta) * 0.4;
    }
    const gap = fill - shown.current;
    if (Math.abs(gap) > 0.001) {
      shown.current += gap * Math.min(1, delta * 4);
      state.invalidate();
    }
    protoplast.current?.scale.setScalar(shown.current);
  });
  return (
    <group position={CELL}>
      <SimulationTicker running={playing} />
      <mesh>
        <torusGeometry args={[0.075, 0.005, 16, 72]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, -0.002]}>
        <circleGeometry args={[0.075, 72]} />
        <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.12} />
      </mesh>
      <mesh castShadow position={[0, (-0.08 - CELL[1]) / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.006, CELL[1] - 0.08, 16]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.lampShade}
          roughness={0.5}
        />
      </mesh>
      <mesh castShadow position={[0, 0.004 - CELL[1], 0]}>
        <cylinderGeometry args={[0.03, 0.034, 0.008, 32]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.lampShade}
          roughness={0.5}
        />
      </mesh>
      <group ref={group} scale={0.9}>
        <RoundedBox args={[0.1, 0.07, 0.07]} radius={0.012}>
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={CELL_COLORS.cellWall}
            depthWrite={false}
            opacity={0.28}
            roughness={0.4}
            transparent
          />
        </RoundedBox>
        <group ref={protoplast}>
          <RoundedBox args={[0.094, 0.064, 0.064]} radius={0.014}>
            <meshPhysicalMaterial
              color={CELL_COLORS.cytoplasm}
              depthWrite={false}
              opacity={0.45}
              roughness={0.5}
              transparent
            />
          </RoundedBox>
          <mesh scale={[0.04, 0.025, 0.025]}>
            <sphereGeometry args={[1, 32, 20]} />
            <meshPhysicalMaterial
              color={CELL_COLORS.vacuole}
              opacity={0.55}
              roughness={0.2}
              transparent
            />
          </mesh>
          <mesh position={[-0.03, 0.012, 0.012]}>
            <sphereGeometry args={[0.008, 20, 14]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.onionNucleus}
              roughness={0.5}
            />
          </mesh>
          {Arr.map(Arr.range(0, 5), (index) => (
            <mesh
              key={index}
              position={[
                0.03 - index * 0.012,
                -0.02,
                0.022 - (index % 2) * 0.04,
              ]}
              scale={[1, 0.8, 0.8]}
            >
              <sphereGeometry args={[0.004, 12, 8]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.starch}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Looks at the rack and the cell from the front and a little above, farther back on a narrow card. */
function OsmosisCamera({ width }: { readonly width: number }) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const span = width + 0.36;
  const distance = span * (narrow ? 1.5 : 1.05);
  return (
    <CameraControls
      cameraPosition={[0.15, 0.1 + distance * 0.25, 0.1 + distance]}
      cameraTarget={[0.15, 0.085, 0.1]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.12}
    />
  );
}
