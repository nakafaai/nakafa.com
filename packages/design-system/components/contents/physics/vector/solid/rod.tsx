import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

/** The rod's own axis, which its cylinder is built along. */
const UP = new Vector3(0, 1, 0);

/**
 * A straight round part from one point to another: a string, a cable, a
 * rope, a pole or a strut. It keeps its thickness at any length. Given what
 * it is made of, it takes that surface's fine detail, galvanised steel or
 * laid rope, instead of a plain colour.
 */
export function Rod({
  color,
  from,
  metalness = 0,
  radius,
  roughness = 0.7,
  surface,
  to,
}: {
  readonly color: string;
  readonly from: CoordinateTuple;
  readonly metalness?: number;
  readonly radius: number;
  readonly roughness?: number;
  readonly surface?: Surface;
  readonly to: CoordinateTuple;
}) {
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  const pose = useMemo(() => {
    const start = new Vector3(fx, fy, fz);
    const span = new Vector3(tx, ty, tz).sub(start);
    const length = span.length();
    return {
      length,
      middle: start.addScaledVector(span, 0.5),
      turn:
        length > 0
          ? new Quaternion().setFromUnitVectors(UP, span.normalize())
          : new Quaternion(),
    };
  }, [fx, fy, fz, tx, ty, tz]);

  return (
    <mesh castShadow position={pose.middle} quaternion={pose.turn}>
      <cylinderGeometry args={[radius, radius, pose.length, 10]} />
      {surface === undefined ? (
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
        />
      ) : (
        <SurfaceMaterial
          color={color}
          metalness={metalness}
          repeat={[1, Math.max(1, pose.length / (radius * 20))]}
          surface={surface}
        />
      )}
    </mesh>
  );
}
