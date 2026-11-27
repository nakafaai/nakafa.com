import { DoubleSide } from "three";

/**
 * The regions a lesson marks on an instrument or on what it measures, in the
 * lesson's colour: the band a value may lie in, the face an area is taken
 * over, the volume a density fills. They glow a little, so they read as a
 * mark on the picture and never as part of the bench. Every lab draws its
 * regions through this file, so they look the same in each of them.
 */

/** A place, or a turn as Euler angles, in the units of the group the region is drawn in. */
type Triple = readonly [number, number, number];

/** How see-through a region is, so what it marks shows through it. */
const SHEER = 0.42;

/**
 * A band between two values: a block `size` wide, tall and deep about `at`.
 * A `solid` band is a line laid on a scale and hides what is behind it.
 *
 * @param at - The middle of the band
 * @param color - The lesson's colour for this quantity
 * @param size - How wide, tall and deep the band is
 * @param solid - Whether the band is a solid line and not a see-through region
 */
export function Band({
  at,
  color,
  size,
  solid = false,
}: {
  readonly at: Triple;
  readonly color: string;
  readonly size: Triple;
  readonly solid?: boolean;
}) {
  return (
    <mesh position={[at[0], at[1], at[2]]}>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <meshStandardMaterial
        color={color}
        depthWrite={solid}
        emissive={color}
        emissiveIntensity={0.5}
        opacity={solid ? 1 : SHEER}
        roughness={0.5}
        transparent={!solid}
      />
    </mesh>
  );
}

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
