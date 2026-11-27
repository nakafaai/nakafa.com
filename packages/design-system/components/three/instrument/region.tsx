import { DoubleSide } from "three";

/**
 * The regions a lesson marks on what an instrument measures, in the lesson's
 * colour: the face an area is taken over, the volume a density fills. They glow a little, so they read as a
 * mark on the picture and never as part of the bench. Every lab draws its
 * regions through this file, so they look the same in each of them.
 */

/** A place, or a turn as Euler angles, in the units of the group the region is drawn in. */
type Triple = readonly [number, number, number];

/** How see-through a region is, so what it marks shows through it. */
const SHEER = 0.42;

/**
 * The round face an area is taken over: a see-through disc about `at`,
 * which shows from both of its sides.
 *
 * @param at - The middle of the face
 * @param color - The lesson's colour for this quantity
 * @param radius - The radius of the face
 * @param turn - How the face turns from facing +z, as Euler angles
 */
export function Patch({
  at,
  color,
  radius,
  turn,
}: {
  readonly at: Triple;
  readonly color: string;
  readonly radius: number;
  readonly turn: Triple;
}) {
  return (
    <mesh
      position={[at[0], at[1], at[2]]}
      rotation={[turn[0], turn[1], turn[2]]}
    >
      <circleGeometry args={[radius, 64]} />
      <meshStandardMaterial
        color={color}
        depthWrite={false}
        emissive={color}
        emissiveIntensity={0.5}
        opacity={SHEER}
        roughness={0.5}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}

/**
 * The volume of a round part: a see-through cylinder about `at`, a little
 * wider than the part it sheathes.
 *
 * @param at - The middle of the sheath
 * @param color - The lesson's colour for this quantity
 * @param long - How long the sheath is
 * @param radius - The radius of the sheath
 * @param turn - How the sheath turns from standing along y, as Euler angles
 */
export function Sheath({
  at,
  color,
  long,
  radius,
  turn,
}: {
  readonly at: Triple;
  readonly color: string;
  readonly long: number;
  readonly radius: number;
  readonly turn: Triple;
}) {
  return (
    <mesh
      position={[at[0], at[1], at[2]]}
      rotation={[turn[0], turn[1], turn[2]]}
    >
      <cylinderGeometry args={[radius, radius, long, 64]} />
      <meshStandardMaterial
        color={color}
        depthWrite={false}
        emissive={color}
        emissiveIntensity={0.5}
        opacity={SHEER}
        roughness={0.5}
        transparent
      />
    </mesh>
  );
}
