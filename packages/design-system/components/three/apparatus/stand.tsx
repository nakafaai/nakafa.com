import { RoundedBox } from "@react-three/drei";
import { armOf } from "@repo/design-system/components/three/apparatus/clamp";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { Array as Arr } from "effect";

/** The stand's base plate: its length toward what it holds, its thickness and its width, in metres. */
const BASE = { height: 0.014, length: 0.26, width: 0.16 } as const;

/** How high the top of a stand's base is above the bench: where what stands on it rests. */
export const STAND_TOP = BASE.height;

/** The rod's radius, and how far the jaws' opening spans, in radians. */
const ROD = 0.0055;
const GAP = 1;

/** A thumbscrew: a threaded shank with a knurled head, lying along +x from the part it tightens. */
function Thumbscrew() {
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.0024, 0.0024, 0.012, 14]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          repeat={[1, 6]}
          roughness={0.4}
          surface="knurl"
        />
      </mesh>
      <mesh castShadow position={[0, 0.0155, 0]}>
        <cylinderGeometry args={[0.0078, 0.0078, 0.007, 32]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          repeat={[7, 1]}
          roughness={0.3}
          surface="knurl"
        />
      </mesh>
    </group>
  );
}

/**
 * A bosshead on the rod at one height with the clamp it carries: a die-cast
 * block with its two thumbscrews, a plated arm out to the glass, and a pair
 * of cork-lined jaws closed round it by a third screw.
 */
function Clamp({
  height,
  level,
  radius,
  reach,
}: {
  readonly height: number;
  readonly level: boolean;
  readonly radius: number;
  readonly reach: number;
}) {
  const jaws = level ? 0 : Math.PI / 2;
  const yoke = reach - radius - 0.016;

  return (
    <group position={[0, height, 0]}>
      <RoundedBox
        args={[0.026, 0.032, 0.024]}
        castShadow
        position={[0.004, 0, 0]}
        radius={0.004}
        smoothness={4}
      >
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          repeat={[1, 1]}
          roughness={0.5}
          surface="cast"
        />
      </RoundedBox>
      <group position={[-0.009, 0.006, 0]} rotation={[0, Math.PI, 0]}>
        <Thumbscrew />
      </group>
      <group position={[0.008, -0.016, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <Thumbscrew />
      </group>
      <mesh
        castShadow
        position={[(yoke + 0.012) / 2, -0.006, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0042, 0.0042, yoke - 0.012, 20]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.chrome}
          metalness={1}
          repeat={[1, 8]}
          roughness={0.16}
          surface="brushed"
        />
      </mesh>
      <group position={[reach, -0.006, 0]}>
        <RoundedBox
          args={[0.016, 0.018, 0.022]}
          castShadow
          position={[yoke - reach, 0, 0]}
          radius={0.003}
          smoothness={3}
        >
          <SurfaceMaterial
            color={LABWARE_COLORS.nickel}
            metalness={1}
            roughness={0.5}
            surface="cast"
          />
        </RoundedBox>
        <group
          position={[yoke - reach, 0, 0.011]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <Thumbscrew />
        </group>
        <mesh castShadow rotation={[jaws, 0, GAP / 2]}>
          <torusGeometry
            args={[radius + 0.0042, 0.0032, 12, 40, Math.PI * 2 - GAP]}
          />
          <SurfaceMaterial
            color={LABWARE_COLORS.nickel}
            metalness={1}
            repeat={[6, 1]}
            roughness={0.42}
            surface="cast"
          />
        </mesh>
        <mesh rotation={[jaws, 0, GAP / 2]}>
          <torusGeometry
            args={[radius + 0.0009, 0.0018, 10, 40, Math.PI * 2 - GAP]}
          />
          <SurfaceMaterial
            bump={1}
            color={LABWARE_COLORS.cork}
            repeat={[6, 1]}
            roughness={0.95}
            surface="wood"
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A retort stand on the bench at y = 0: a heavy stove-enamelled cast iron
 * base, a plated rod screwed into it behind a hexagon nut, and at each
 * height it `holds` something a bosshead and a clamp whose cork-lined jaws
 * close round the glass. The stand turns to face what it holds, and each
 * arm is as long as the rod and the glass are apart. The jaws close round
 * upright glass such as a burette, or round glass that `lies` level across
 * the arm, such as a gas syringe.
 *
 * @example
 * <Stand at={[-0.11, -0.04]} height={0.9} holds={[{ at: [0, 0.62, 0.05], radius: 0.0065 }]} />
 *
 * @param at - Where the rod stands on the bench, as x and z
 * @param height - How tall the rod is
 * @param holds - What it grips: the place of each grip, the radius of the glass there, and whether the glass lies level
 */
export function Stand({
  at,
  height,
  holds,
}: {
  readonly at: readonly [number, number];
  readonly height: number;
  readonly holds: Arr.NonEmptyReadonlyArray<{
    readonly at: readonly [number, number, number];
    readonly lies?: "level";
    readonly radius: number;
  }>;
}) {
  const facing = armOf(at, Arr.headNonEmpty(holds).at);

  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, facing.turn, 0]}>
      <RoundedBox
        args={[BASE.length, BASE.height, BASE.width]}
        castShadow
        position={[BASE.length / 2 - 0.035, BASE.height / 2, 0]}
        radius={0.004}
        receiveShadow
        smoothness={4}
      >
        <SurfaceMaterial
          bump={0.9}
          coat={0.2}
          color={LABWARE_COLORS.castIron}
          repeat={[3, 2]}
          roughness={0.7}
          surface="cast"
        />
      </RoundedBox>
      <mesh castShadow position={[0, BASE.height + 0.005, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.01, 6]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          roughness={0.36}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, BASE.height + height / 2, 0]}>
        <cylinderGeometry args={[ROD, ROD, height, 24]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.chrome}
          metalness={1}
          repeat={[1, 30]}
          roughness={0.14}
          surface="brushed"
        />
      </mesh>
      {Arr.map(holds, (hold) => (
        <Clamp
          height={hold.at[1]}
          key={hold.at[1]}
          level={hold.lies === "level"}
          radius={hold.radius}
          reach={armOf(at, hold.at).reach}
        />
      ))}
    </group>
  );
}
