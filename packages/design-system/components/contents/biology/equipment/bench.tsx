import {
  BENCH,
  BENCH_TOP,
  WALLS,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, ExtrudeGeometry, Path, Shape, Vector3 } from "three";

/** The worktop's thickness: a 30 mm slab of epoxy resin. */
const WORKTOP = 0.03;

/** The sink's opening in the worktop and its depth, in metres. */
const SINK = {
  depth: 0.18,
  left: -1.42,
  right: -1.02,
  back: -0.53,
  front: -0.23,
} as const;

/** The worktop's outline seen from above, with the sink's opening cut out of it, extruded 30 mm thick. */
function createWorktop() {
  const outline = new Shape();
  outline.moveTo(WALLS.side, WALLS.back);
  outline.lineTo(BENCH.right, WALLS.back);
  outline.lineTo(BENCH.right, BENCH.front - 0.002);
  outline.lineTo(WALLS.side, BENCH.front - 0.002);
  outline.closePath();
  const opening = new Path();
  opening.moveTo(SINK.left, SINK.back);
  opening.lineTo(SINK.left, SINK.front);
  opening.lineTo(SINK.right, SINK.front);
  opening.lineTo(SINK.right, SINK.back);
  opening.closePath();
  outline.holes = [opening];
  const geometry = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    depth: WORKTOP - 0.004,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, BENCH_TOP - 0.002, 0);
  return geometry;
}

/** The doors along the cabinet's front, each with its D-pull handle. */
const DOORS = Arr.map(Arr.range(0, 3), (index) => {
  const width = (BENCH.right - WALLS.side - 0.02) / 4;
  return { key: index, x: WALLS.side + 0.01 + (index + 0.5) * width, width };
});

/**
 * The bench along the back wall at the EN 13150 standing height: a black
 * epoxy resin worktop with a sink let into it, on a laminate cabinet with
 * doors and a recessed plinth.
 */
export function Bench() {
  const top = useMemo(createWorktop, []);
  useEffect(() => () => top.dispose(), [top]);
  const front = BENCH.front - 0.04;
  return (
    <group>
      <mesh castShadow geometry={top} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.28}
          color={LABORATORY_COLORS.worktop}
          roughness={0.5}
        />
      </mesh>
      <mesh
        position={[
          (WALLS.side + BENCH.right) / 2,
          (0.1 + BENCH_TOP - WORKTOP) / 2,
          (WALLS.back + front) / 2,
        ]}
        receiveShadow
      >
        <boxGeometry
          args={[
            BENCH.right - WALLS.side - 0.02,
            BENCH_TOP - WORKTOP - 0.1,
            front - WALLS.back,
          ]}
        />
        <meshStandardMaterial
          color={LABORATORY_COLORS.cabinet}
          roughness={0.55}
        />
      </mesh>
      <mesh
        position={[
          (WALLS.side + BENCH.right) / 2,
          0.05,
          (WALLS.back + front - 0.06) / 2,
        ]}
      >
        <boxGeometry
          args={[
            BENCH.right - WALLS.side - 0.02,
            0.1,
            front - 0.06 - WALLS.back,
          ]}
        />
        <meshStandardMaterial
          color={LABORATORY_COLORS.plinth}
          roughness={0.7}
        />
      </mesh>
      {Arr.map(DOORS, (door) => (
        <group key={door.key} position={[door.x, 0.49, front + 0.009]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[door.width - 0.006, 0.72, 0.018]} />
            <meshPhysicalMaterial
              clearcoat={0.2}
              color={LABORATORY_COLORS.cabinet}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[0, 0.3, 0.03]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.13, 12]} />
            <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.3} />
          </mesh>
          {Arr.map([-0.055, 0.055] as const, (x) => (
            <mesh
              key={x}
              position={[x, 0.3, 0.02]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.004, 0.004, 0.022, 10]} />
              <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      <Sink />
      <Tap />
      <GasTap />
    </group>
  );
}

/** The sink's bowl of black epoxy under the worktop's opening, with a chrome waste at the bottom. */
function Sink() {
  const width = SINK.right - SINK.left;
  const depth = SINK.front - SINK.back;
  const middle = [
    (SINK.left + SINK.right) / 2,
    (SINK.back + SINK.front) / 2,
  ] as const;
  const floor = BENCH_TOP - WORKTOP - SINK.depth;
  const walls = [
    {
      key: "back",
      position: [middle[0], 0, SINK.back - 0.006],
      size: [width + 0.024, SINK.depth, 0.012],
    },
    {
      key: "front",
      position: [middle[0], 0, SINK.front + 0.006],
      size: [width + 0.024, SINK.depth, 0.012],
    },
    {
      key: "left",
      position: [SINK.left - 0.006, 0, middle[1]],
      size: [0.012, SINK.depth, depth],
    },
    {
      key: "right",
      position: [SINK.right + 0.006, 0, middle[1]],
      size: [0.012, SINK.depth, depth],
    },
  ] as const;
  return (
    <group>
      {Arr.map(walls, (wall) => (
        <mesh
          key={wall.key}
          position={[
            wall.position[0],
            floor + SINK.depth / 2,
            wall.position[2],
          ]}
          receiveShadow
        >
          <boxGeometry args={wall.size} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={LABORATORY_COLORS.sink}
            roughness={0.45}
          />
        </mesh>
      ))}
      <mesh position={[middle[0], floor - 0.006, middle[1]]} receiveShadow>
        <boxGeometry args={[width + 0.024, 0.012, depth + 0.024]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={LABORATORY_COLORS.sink}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[middle[0], floor + 0.002, middle[1]]}>
        <cylinderGeometry args={[0.035, 0.035, 0.004, 32]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.2} />
      </mesh>
    </group>
  );
}

/** A chrome swan-neck laboratory tap behind the sink, its spout over the bowl and a wrist-action lever on its side. */
function Tap() {
  const neck = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.05, 0),
        new Vector3(0, 0.24, 0),
        new Vector3(0, 0.31, 0.05),
        new Vector3(0, 0.29, 0.15),
        new Vector3(0, 0.22, 0.2),
      ]),
    []
  );
  return (
    <group
      position={[(SINK.left + SINK.right) / 2, BENCH_TOP, SINK.back - 0.09]}
    >
      <mesh castShadow position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.018, 0.024, 0.05, 28]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.12} />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[neck, 48, 0.009, 16, false]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0.205, 0.2]}>
        <cylinderGeometry args={[0.007, 0.006, 0.03, 16]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.15} />
      </mesh>
      <mesh
        castShadow
        position={[0.05, 0.04, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.005, 0.006, 0.09, 12]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.15} />
      </mesh>
    </group>
  );
}

/** Where the gas tap stands at the back of the bench, behind the burner, in metres. */
export const GAS_TAP = [0.12, BENCH_TOP, WALLS.back + 0.045] as const;

/** A chrome gas turret with its yellow lever and a serrated nozzle the burner's tubing pushes onto. */
function GasTap() {
  return (
    <group position={GAS_TAP}>
      <mesh castShadow position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.014, 0.018, 0.07, 24]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.15} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.06, 0.025]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.005, 0.006, 0.04, 14]} />
        <MetalMaterial color={LABORATORY_COLORS.brass} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.018, 0.074, 0]}>
        <boxGeometry args={[0.05, 0.008, 0.012]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.gasLever}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}
