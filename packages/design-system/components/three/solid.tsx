import { Line } from "@react-three/drei";
import { faceMesh } from "@repo/design-system/lib/geometry/mesh";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { type ColorRepresentation, DoubleSide } from "three";

/** Draws a solid with flat faces, such as a prism or a pyramid, and its edges. */
export function Solid({
  color,
  faces,
}: {
  readonly color: ColorRepresentation;
  readonly faces: readonly (readonly Point3[])[];
}) {
  const mesh = useMemo(() => faceMesh(faces), [faces]);
  const loops = useMemo(
    () =>
      Arr.map(faces, (face) =>
        Arr.map([...face, ...Arr.take(face, 1)], ({ x, y, z }) => [x, y, z] as const)
      ),
    [faces]
  );
  return (
    <group>
      <mesh>
        <bufferGeometry onUpdate={(geometry) => geometry.computeVertexNormals()}>
          <bufferAttribute args={[mesh.positions, 3]} attach="attributes-position" />
          <bufferAttribute args={[mesh.indices, 1]} attach="index" />
        </bufferGeometry>
        <meshStandardMaterial
          color={color}
          flatShading
          metalness={0.05}
          opacity={0.78}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          roughness={0.5}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map(loops, (loop, index) => (
        <Line color={color} key={index} lineWidth={2} points={[...loop]} />
      ))}
    </group>
  );
}
