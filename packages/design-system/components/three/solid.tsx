import { Line } from "@react-three/drei";
import { faceMesh, meshGeometry } from "@repo/design-system/lib/geometry/mesh";
import { type Point3, pointsKey } from "@repo/design-system/lib/geometry/point";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import {
  type ColorRepresentation,
  DoubleSide,
  MeshStandardMaterial,
} from "three";

/** Draws a solid with flat faces, such as a prism or a pyramid, and its edges. */
export function Solid({
  color,
  faces,
}: {
  readonly color: ColorRepresentation;
  readonly faces: readonly (readonly Point3[])[];
}) {
  const geometry = useMemo(() => meshGeometry(faceMesh(faces)), [faces]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        flatShading: true,
        metalness: 0.05,
        opacity: 0.78,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        roughness: 0.5,
        side: DoubleSide,
        transparent: true,
      }),
    [color]
  );
  const loops = useMemo(
    () =>
      Arr.map(faces, (face) => ({
        key: pointsKey(face),
        points: Arr.map(
          [...face, ...Arr.take(face, 1)],
          ({ x, y, z }) => [x, y, z] as const
        ),
      })),
    [faces]
  );
  return (
    <group>
      <mesh geometry={geometry} material={material} />
      {Arr.map(loops, (loop) => (
        <Line color={color} key={loop.key} lineWidth={2} points={loop.points} />
      ))}
    </group>
  );
}
