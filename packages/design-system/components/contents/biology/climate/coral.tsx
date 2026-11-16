import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";
import { createContext, use, useMemo } from "react";
import {
  Color,
  DoubleSide,
  LatheGeometry,
  SphereGeometry,
  Vector2,
} from "three";

/** The colour of living coral tissue, which every coral in the tank shares as it pales. */
export const Tissue = createContext(new Color());

/**
 * A branching coral colony like Acropora: branches that fan up from a short
 * base and fork in two, each fork tipped with a paler growing tip.
 */
export function BranchingCoral({
  position,
  seed,
  tips,
}: {
  readonly position: readonly [number, number, number];
  readonly seed: number;
  readonly tips: Color;
}) {
  const branches = useMemo(() => branchesOf(seed), [seed]);
  return (
    <group position={position}>
      {Arr.map(branches, ([id, x, y, z, tiltX, tiltZ, length, radius]) => (
        <group key={id} position={[x, y, z]} rotation={[tiltX, 0, tiltZ]}>
          <Branch length={length} radius={radius} />
          {Arr.map([-1, 1], (side) => (
            <group
              key={side}
              position={[0, length, 0]}
              rotation={[side * 0.35, 0, side * 0.55]}
            >
              <Branch length={length * 0.55} radius={radius * 0.8} />
              <mesh castShadow position={[0, length * 0.55, 0]}>
                <sphereGeometry args={[radius * 0.7, 10, 8]} />
                <meshStandardMaterial color={tips} roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** One tapering stretch of a coral branch, standing on its base. */
function Branch({
  length,
  radius,
}: {
  readonly length: number;
  readonly radius: number;
}) {
  const color = use(Tissue);
  return (
    <mesh castShadow position={[0, length / 2, 0]}>
      <cylinderGeometry args={[radius * 0.8, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

/**
 * A plate coral such as Turbinaria: a short stalk that opens into a broad,
 * shallow cup whose rim lifts and waves, its surface pitted by its polyps.
 */
export function PlateCoral() {
  const color = use(Tissue);
  const geometry = useMemo(() => {
    const profile = Arr.map(
      [
        [0.004, 0],
        [0.009, 0.004],
        [0.012, 0.018],
        [0.03, 0.026],
        [0.055, 0.03],
        [0.072, 0.036],
        [0.078, 0.046],
        [0.074, 0.049],
        [0.066, 0.041],
        [0.048, 0.034],
        [0.02, 0.03],
        [0.002, 0.028],
      ] as const,
      ([radius, height]) => new Vector2(radius, height)
    );
    const cup = new LatheGeometry(profile, 72);
    const positions = cup.attributes.position;
    if (positions) {
      Arr.forEach(Arr.range(0, positions.count - 1), (index) => {
        const x = positions.getX(index);
        const z = positions.getZ(index);
        const reach = Math.hypot(x, z);
        const wave = Math.sin(Math.atan2(z, x) * 5) * 0.004 * (reach / 0.078);
        const pits = (valueNoise(x * 600, z * 600, 64) - 0.5) * 0.0015;
        positions.setY(index, positions.getY(index) + wave + pits);
      });
    }
    cup.computeVertexNormals();
    return cup;
  }, []);
  return (
    <mesh
      castShadow
      geometry={geometry}
      position={[-0.03, 0.035, 0.09]}
      receiveShadow
      rotation={[0.08, 0, 0.1]}
    >
      <meshStandardMaterial color={color} roughness={0.85} side={DoubleSide} />
    </mesh>
  );
}

/**
 * A brain coral: a dome whose surface folds into meandering ridges and
 * valleys, raised from seeded value noise so every visit shows the same
 * maze.
 */
export function BrainCoral() {
  const color = use(Tissue);
  const geometry = useMemo(() => {
    const dome = new SphereGeometry(0.06, 96, 64);
    const positions = dome.attributes.position;
    if (positions) {
      Arr.forEach(Arr.range(0, positions.count - 1), (index) => {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const ridge = Math.sin(
          valueNoise((x + 0.06) * 90, (z + 0.06) * 90, 16) * Math.PI * 9 +
            y * 60
        );
        const lift = 1 + 0.035 * ridge;
        positions.setXYZ(index, x * lift, y * lift, z * lift);
      });
    }
    dome.computeVertexNormals();
    return dome;
  }, []);
  return (
    <mesh
      castShadow
      geometry={geometry}
      position={[0.02, 0.07, -0.06]}
      scale={[1, 0.7, 1]}
    >
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

/**
 * The branches of colony `seed`: each as its number, its base point, its two tilts, its
 * length and its radius, in metres. Twelve branches fan up from the base at
 * seeded angles and heights.
 */
function branchesOf(seed: number) {
  return Arr.map(Arr.range(0, 13), (branch) => {
    const angle = hashUnit(seed, branch) * Math.PI * 2;
    const lean = 0.2 + hashUnit(seed + 7, branch) * 0.6;
    const height = hashUnit(seed + 3, branch) * 0.03;
    return [
      branch,
      Math.cos(angle) * 0.015,
      height,
      Math.sin(angle) * 0.015,
      Math.sin(angle) * lean,
      -Math.cos(angle) * lean,
      0.06 + hashUnit(seed + 5, branch) * 0.06,
      0.007,
    ] as const;
  });
}
