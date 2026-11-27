import { Turn } from "@repo/design-system/components/three/form/part";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

type Place = readonly [number, number, number];

const UP = new Vector3(0, 1, 0);

/** A shaft and a head one unit thick and one unit long, as outlines turned about the arrow's line: each arrow scales them to its own size. */
const SHAFT = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;
const HEAD = [
  [0, 0],
  [1, 0],
  [0, 1],
] as const;

/**
 * A velocity drawn in the world as a solid arrow from `from` to `to`, in
 * metres, in the colour its fact carries in the legend. It glows a little,
 * so it reads against water, road and sky in both themes. An arrow too
 * short to see is not drawn, so a velocity of zero shows nothing.
 *
 * @param color - The arrow's colour, which the lab ties to its legend
 * @param from - Where the arrow starts
 * @param thick - The radius of the shaft
 * @param to - Where the arrow's tip ends
 */
export function VelocityArrow({
  color,
  from,
  thick,
  to,
}: {
  readonly color: string;
  readonly from: Place;
  readonly thick: number;
  readonly to: Place;
}) {
  const { length, turn } = useMemo(() => {
    const span = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    return {
      length: span.length(),
      turn: new Quaternion().setFromUnitVectors(UP, span.normalize()),
    };
  }, [from, to]);
  const head = Math.min(thick * 7, length * 0.5);

  if (length < thick * 2) {
    return null;
  }

  return (
    <group position={from} quaternion={turn}>
      <mesh castShadow scale={[thick, length - head, thick]}>
        <Turn profile={SHAFT} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, length - head, 0]}
        scale={[thick * 2.6, head, thick * 2.6]}
      >
        <Turn profile={HEAD} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}
