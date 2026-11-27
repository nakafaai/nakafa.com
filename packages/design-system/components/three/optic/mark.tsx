import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/**
 * The marks a diagram lays over the apparatus it teaches with: they are
 * flat ink, not part of the scene, so they keep their colour in light and
 * dark, cast no shadow and take no light.
 */

/**
 * A point of a diagram, such as a focal point on the axis of a lens: a dot
 * in the plane of the rays, drawn over whatever stands there.
 *
 * @param color - The ink of the dot
 * @param size - Its radius, in scene units
 */
export function Dot({
  color,
  size,
}: {
  readonly color: string;
  readonly size: number;
}) {
  return (
    <mesh renderOrder={12}>
      <circleGeometry args={[size, 28]} />
      <meshBasicMaterial
        color={color}
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

/**
 * A measured length of a diagram: a line `long` along +x from the origin,
 * with a foot across it at each end along +y. A lab turns its group to lay
 * it where the length is measured, such as up the side of a tank or along
 * the front of a bench.
 *
 * @param color - The ink of the measure, the colour its reading has in the card
 * @param long - The length it spans, in scene units
 * @param foot - How long each foot is
 * @param thick - How thick the line and its feet are
 */
export function Span({
  color,
  foot,
  long,
  thick,
}: {
  readonly color: string;
  readonly foot: number;
  readonly long: number;
  readonly thick: number;
}) {
  return (
    <group>
      {Arr.map(
        [
          { at: long / 2, key: "line", size: [long, thick, thick] },
          { at: 0, key: "start", size: [thick, foot, thick] },
          { at: long, key: "end", size: [thick, foot, thick] },
        ] as const,
        (bar) => (
          <mesh key={bar.key} position={[bar.at, 0, 0]}>
            <boxGeometry args={bar.size} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )
      )}
    </group>
  );
}
