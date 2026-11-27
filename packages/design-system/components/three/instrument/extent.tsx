import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

type Point = readonly [number, number, number];

/** The direction an unturned arrow points in. */
const UP = new Vector3(0, 1, 0);

/**
 * The extent an instrument measures, drawn beside the object as a slim
 * double-headed arrow in the lesson's colour: the length a rule spans, the
 * diameter a caliper closes on. It glows a little, so it reads as a mark on
 * the picture and never as part of the bench.
 *
 * @param from - Where the extent starts
 * @param to - Where it ends
 * @param color - The lesson's colour for this quantity
 * @param weight - How thick the shaft is
 */
export function Extent({
  color,
  from,
  to,
  weight,
}: {
  readonly color: string;
  readonly from: Point;
  readonly to: Point;
  readonly weight: number;
}) {
  const span = useMemo(
    () => new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]),
    [from, to]
  );
  const turn = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, span.clone().normalize()),
    [span]
  );
  const length = span.length();
  const head = Math.min(weight * 5, length * 0.3);

  return (
    <group
      position={[
        (from[0] + to[0]) / 2,
        (from[1] + to[1]) / 2,
        (from[2] + to[2]) / 2,
      ]}
      quaternion={turn}
    >
      <mesh>
        <cylinderGeometry args={[weight, weight, length - head * 2, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, length / 2 - head / 2, 0]}>
        <coneGeometry args={[weight * 2.6, head, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -length / 2 + head / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[weight * 2.6, head, 24]} />
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
