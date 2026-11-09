import { Line } from "@react-three/drei";
import { fanMesh } from "@repo/design-system/lib/geometry/mesh";
import { type Point3, pointsKey } from "@repo/design-system/lib/geometry/point";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { type ColorRepresentation, DoubleSide } from "three";

/**
 * Shades the part of a plane where a set of inequalities holds, and draws each
 * edge solid where it belongs to the region and dashed where it does not.
 */
export function Region({
  boundary,
  color,
  fill,
}: {
  readonly boundary: readonly {
    readonly points: readonly Point3[];
    readonly strict: boolean;
  }[];
  readonly color: ColorRepresentation;
  readonly fill: readonly (readonly Point3[])[];
}) {
  const mesh = useMemo(() => fanMesh(fill), [fill]);
  return (
    <group>
      <mesh>
        <bufferGeometry>
          <bufferAttribute
            args={[mesh.positions, 3]}
            attach="attributes-position"
          />
          <bufferAttribute args={[mesh.indices, 1]} attach="index" />
        </bufferGeometry>
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={0.18}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map(boundary, (edge) => (
        <Line
          color={color}
          dashed={edge.strict}
          dashSize={0.18}
          gapSize={0.12}
          key={pointsKey(edge.points)}
          lineWidth={2}
          points={Arr.map(edge.points, ({ x, y, z }) => [x, y, z] as const)}
        />
      ))}
    </group>
  );
}
