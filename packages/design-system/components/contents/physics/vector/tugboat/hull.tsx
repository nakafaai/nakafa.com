import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/**
 * A ship's hull in plan, raised into a solid: a square stern, straight sides
 * and a bow that curves in to its stem, with rounded edges where deck and
 * sides meet. It lies along +x with its keel at zero and its deck at
 * `height`, in scene units.
 */
export function Hull({
  beam,
  bow,
  color,
  height,
  length,
}: {
  /** The hull's width, in scene units. */
  readonly beam: number;
  /** How far back from the stem the bow starts to curve in, in scene units. */
  readonly bow: number;
  readonly color: string;
  readonly height: number;
  readonly length: number;
}) {
  const geometry = useMemo(() => {
    const half = beam / 2;
    const stem = length / 2;
    const plan = new Shape();
    plan.moveTo(-stem, -half);
    plan.lineTo(stem - bow, -half);
    plan.quadraticCurveTo(stem - bow * 0.15, -half, stem, 0);
    plan.quadraticCurveTo(stem - bow * 0.15, half, stem - bow, half);
    plan.lineTo(-stem, half);
    plan.closePath();
    return new ExtrudeGeometry(plan, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: beam * 0.04,
      bevelThickness: beam * 0.04,
      curveSegments: 16,
      depth: height,
    });
  }, [beam, bow, height, length]);

  return (
    <mesh
      castShadow
      geometry={geometry}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}
