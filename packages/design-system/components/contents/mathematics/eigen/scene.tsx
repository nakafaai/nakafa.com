import { Line } from "@react-three/drei";
import type { EigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";
import { evaluateEigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

export function EigenTransform3DScene({
  parts,
  progress,
  transform,
}: {
  readonly parts: Readonly<
    Record<
      | "basisAxes"
      | "eigenvectorOne"
      | "eigenvectorThree"
      | "eigenvectorTwo"
      | "testVector"
      | "transformedGrid",
      string
    >
  >;
  readonly progress: number;
  readonly transform: EigenTransform;
}) {
  const state = evaluateEigenTransform(transform, progress);

  const faces = useMemo(() => {
    const mapPt = (x: number, y: number, z: number) => ({
      x: x * state.scaleX + y * state.shearXY,
      y: y * state.scaleY,
      z: z * state.scaleZ,
    });
    const p000 = mapPt(0, 0, 0);
    const p100 = mapPt(1, 0, 0);
    const p110 = mapPt(1, 1, 0);
    const p010 = mapPt(0, 1, 0);
    const p001 = mapPt(0, 0, 1);
    const p101 = mapPt(1, 0, 1);
    const p111 = mapPt(1, 1, 1);
    const p011 = mapPt(0, 1, 1);
    return [
      { id: "back", vertices: [p000, p100, p110, p010] },
      { id: "front", vertices: [p001, p101, p111, p011] },
      { id: "bottom", vertices: [p000, p100, p101, p001] },
      { id: "top", vertices: [p010, p110, p111, p011] },
      { id: "left", vertices: [p000, p010, p011, p001] },
      { id: "right", vertices: [p100, p110, p111, p101] },
    ] as const;
  }, [state.scaleX, state.scaleY, state.scaleZ, state.shearXY]);

  const testTo: readonly [number, number, number] = [
    0.85 * state.scaleX + 0.85 * state.shearXY,
    0.85 * state.scaleY,
    0.65 * state.scaleZ,
  ];

  return (
    <group>
      {/* Translucent transformed unit cube so internal vectors shine through */}
      {Arr.map(faces, (face) => {
        const closed = [...face.vertices, face.vertices[0]];
        return (
          <group key={face.id}>
            <Polygon
              color={CALCULUS_COLORS.cobaltCurve}
              opacity={0.16}
              vertices={face.vertices}
            />
            <Line
              color={CALCULUS_COLORS.cobaltCurve}
              lineWidth={1.8}
              points={Arr.map(closed, ({ x, y, z }) => [x, y, z] as const)}
            />
          </group>
        );
      })}
      {/* Eigenvectors staying along invariant axes */}
      <ArrowHelper
        color={CALCULUS_COLORS.emeraldSlope}
        from={[0, 0, 0]}
        label={parts.eigenvectorOne}
        labelSize="compact"
        lineWidth={3}
        to={[state.scaleX * 1.45, 0, 0]}
      />
      <ArrowHelper
        color={CALCULUS_COLORS.violetNormal}
        from={[0, 0, 0]}
        label={parts.eigenvectorTwo}
        labelSize="compact"
        lineWidth={3}
        to={[0, state.scaleY * 1.45, 0]}
      />
      <ArrowHelper
        color={CALCULUS_COLORS.cyanPlane}
        from={[0, 0, 0]}
        label={parts.eigenvectorThree}
        labelSize="compact"
        lineWidth={3}
        to={[0, 0, state.scaleZ * 1.45]}
      />
      {/* General test vector rotating off-axis under shear */}
      <ArrowHelper
        color={CALCULUS_COLORS.amberAccent}
        from={[0, 0, 0]}
        label={parts.testVector}
        labelOffset={[0.35, 0.15, 0.2]}
        labelSize="compact"
        lineWidth={3}
        to={testTo}
      />
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[
          state.scaleX * 0.5 + state.shearXY * 0.6,
          state.scaleY + 0.35,
          state.scaleZ * 0.5,
        ]}
      >
        <span>{parts.transformedGrid}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[-1.4, -0.35, 0]}
      >
        <span>{parts.basisAxes}</span>
      </ThreeLabel>
    </group>
  );
}
