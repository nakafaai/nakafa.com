import { Line } from "@react-three/drei";
import type { ParallelepipedConfig } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";
import { evaluateParallelepiped } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const BASE_U = { x: 2.0, y: 0, z: 0 } as const;

export function VectorParallelepipedScene({
  configuration,
  elevation,
  parts,
}: {
  readonly configuration: ParallelepipedConfig;
  readonly elevation: number;
  readonly parts: Readonly<
    Record<
      | "altitudeLine"
      | "baseParallelogram"
      | "parallelepipedMesh"
      | "vectorU"
      | "vectorV"
      | "vectorW",
      string
    >
  >;
}) {
  const reading = evaluateParallelepiped(configuration, elevation);
  const { baseVerts, solidFaces, u, v, w } = useMemo(() => {
    const vecV =
      configuration === "orthogonalBox"
        ? { x: 0, y: 0, z: 1.5 }
        : { x: 0.55, y: 0, z: 1.35 };
    const vecW =
      configuration === "coplanarFlat"
        ? { x: 0.9, y: 0.04, z: 0.85 }
        : {
            x: configuration === "shearedPrism" ? 0.8 : 0.25,
            y: Math.max(0.06, reading.altitude),
            z: configuration === "shearedPrism" ? 0.45 : 0.15,
          };
    const p000 = { x: 0, y: 0, z: 0 };
    const p100 = BASE_U;
    const p010 = vecV;
    const p110 = { x: BASE_U.x + vecV.x, y: 0, z: BASE_U.z + vecV.z };
    const p001 = vecW;
    const p101 = { x: BASE_U.x + vecW.x, y: vecW.y, z: BASE_U.z + vecW.z };
    const p011 = { x: vecV.x + vecW.x, y: vecW.y, z: vecV.z + vecW.z };
    const p111 = {
      x: BASE_U.x + vecV.x + vecW.x,
      y: vecW.y,
      z: BASE_U.z + vecV.z + vecW.z,
    };
    return {
      baseVerts: [p000, p100, p110, p010] as const,
      solidFaces: [
        { id: "bottom", vertices: [p000, p100, p110, p010] },
        { id: "top", vertices: [p001, p101, p111, p011] },
        { id: "back", vertices: [p000, p100, p101, p001] },
        { id: "front", vertices: [p010, p110, p111, p011] },
        { id: "left", vertices: [p000, p010, p011, p001] },
        { id: "right", vertices: [p100, p110, p111, p101] },
      ] as const,
      u: BASE_U,
      v: vecV,
      w: vecW,
    };
  }, [configuration, reading.altitude]);

  return (
    <group>
      {/* Base parallelogram */}
      <Polygon
        color={CALCULUS_COLORS.cyanPlane}
        opacity={0.32}
        vertices={baseVerts}
      />
      {/* Translucent 3D parallelepiped prism so spanning vectors shine through */}
      {reading.coplanar
        ? null
        : Arr.map(solidFaces, (face) => {
            const closed = [...face.vertices, face.vertices[0]];
            return (
              <group key={face.id}>
                <Polygon
                  color={CALCULUS_COLORS.indigoPrism}
                  opacity={0.18}
                  vertices={face.vertices}
                />
                <Line
                  color={CALCULUS_COLORS.indigoPrism}
                  lineWidth={1.8}
                  points={Arr.map(closed, ({ x, y, z }) => [x, y, z] as const)}
                />
              </group>
            );
          })}
      {/* Spanning vectors u, v, w */}
      <ArrowHelper
        color={CALCULUS_COLORS.cobaltCurve}
        from={[0, 0, 0]}
        label={parts.vectorU}
        labelSize="compact"
        lineWidth={3}
        to={[u.x, u.y, u.z]}
      />
      <ArrowHelper
        color={CALCULUS_COLORS.emeraldSlope}
        from={[0, 0, 0]}
        label={parts.vectorV}
        labelSize="compact"
        lineWidth={3}
        to={[v.x, v.y, v.z]}
      />
      <ArrowHelper
        color={CALCULUS_COLORS.amberAccent}
        from={[0, 0, 0]}
        label={parts.vectorW}
        labelOffset={[-0.28, 0.16, 0]}
        labelSize="compact"
        lineWidth={3}
        to={[w.x, w.y, w.z]}
      />
      {/* Vertical altitude h */}
      <Line
        color={CALCULUS_COLORS.roseAlert}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        lineWidth={2.4}
        points={[
          [w.x, w.y, w.z],
          [w.x, 0, w.z],
        ]}
      />
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[1.1, -0.25, 1.55]}
      >
        <span>{parts.baseParallelogram}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.indigoPrism}
        fontSize="compact"
        position={[1.65, w.y + 0.35, 0.95]}
      >
        <span>{parts.parallelepipedMesh}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[w.x + 0.32, w.y * 0.5, w.z]}
      >
        <span>{parts.altitudeLine}</span>
      </ThreeLabel>
    </group>
  );
}
