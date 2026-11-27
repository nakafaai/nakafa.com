import { Line } from "@react-three/drei";
import { faceMesh, meshGeometry } from "@repo/design-system/lib/geometry/mesh";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import type { ColorRepresentation } from "three";
import { DoubleSide } from "three";

/**
 * A see-through solid drawn the way a geometry tool draws one: every flat
 * face is an unlit, translucent fill, and every face's outline is a crisp
 * line. The edges alone give the solid its depth, so it needs no shading and
 * no shadow, and whatever stands inside it stays readable. All the faces are
 * one mesh and all the edges one line, however many faces the solid has.
 */
export function Facets({
  color,
  edgeWidth = 2,
  faces,
  opacity = 0.14,
}: {
  readonly color: ColorRepresentation;
  readonly edgeWidth?: number;
  readonly faces: readonly (readonly Point3[])[];
  readonly opacity?: number;
}) {
  const geometry = useMemo(() => meshGeometry(faceMesh(faces)), [faces]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Each edge is its own segment: a corner, then the next one round its face.
  const edges = useMemo(
    () =>
      Arr.flatMap(faces, (face) =>
        Arr.flatMap(face, (corner, index) => {
          const next = face[(index + 1) % face.length] ?? corner;
          return [
            [corner.x, corner.y, corner.z] as const,
            [next.x, next.y, next.z] as const,
          ];
        })
      ),
    [faces]
  );

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={opacity}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <Line
        color={color}
        lineWidth={edgeWidth}
        points={edges}
        segments
        toneMapped={false}
      />
    </group>
  );
}
