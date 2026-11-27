import { Line } from "@react-three/drei";
import type { EigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";
import { evaluateEigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { Facets } from "@repo/design-system/components/three/facets";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The vector that lies on no eigenvector's span, so the map turns it. */
const TEST = { x: 0.85, y: 0.85, z: 0.65 } as const;
/** How far each eigenvector's span is drawn to either side of the origin. */
const SPAN = 1.5;
/** The corners of the unit cube, and the four corners of each of its faces. */
const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
] as const;
const FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [3, 2, 6, 7],
  [0, 3, 7, 4],
  [1, 2, 6, 5],
] as const;
/** The twelve edges of the unit cube before the map, as pairs of corners. */
const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

export function EigenTransform3DScene({
  parts,
  progress,
  sweep,
  transform,
}: {
  readonly parts: Readonly<
    Record<
      | "eigenvectorOne"
      | "eigenvectorThree"
      | "eigenvectorTwo"
      | "testVector"
      | "transformedGrid",
      string
    >
  >;
  readonly progress: number;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
  readonly transform: EigenTransform;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const state = evaluateEigenTransform(transform, progress);
  const { scaleX, scaleY, scaleZ, shearXY } = state;
  const target = evaluateEigenTransform(transform, 1);

  const faces = useMemo(
    () =>
      Arr.map(FACES, (face) =>
        Arr.map(face, (index) => {
          const [x, y, z] = CORNERS[index];
          return { x: x * scaleX + y * shearXY, y: y * scaleY, z: z * scaleZ };
        })
      ),
    [scaleX, scaleY, scaleZ, shearXY]
  );

  // The second eigenvector of [[a, s], [0, b]] is (s, b - a): it leans with the shear, never along Y alone.
  const lean = Math.hypot(target.shearXY, target.scaleY - target.scaleX);
  const second =
    target.shearXY === 0 || lean === 0
      ? { x: 0, y: 1 }
      : {
          x:
            (-target.shearXY / lean) * Math.sign(target.scaleX - target.scaleY),
          y:
            ((target.scaleX - target.scaleY) / lean) *
            Math.sign(target.scaleX - target.scaleY),
        };
  const tested = {
    x: TEST.x * scaleX + TEST.y * shearXY,
    y: TEST.y * scaleY,
    z: TEST.z * scaleZ,
  };
  const eigen = [
    {
      color: colors.slope,
      direction: [1, 0, 0],
      name: parts.eigenvectorOne,
      symbol: "\\lambda_1",
      value: scaleX,
    },
    {
      color: colors.normal,
      direction: [second.x, second.y, 0],
      name: parts.eigenvectorTwo,
      symbol: "\\lambda_2",
      value: scaleY,
    },
    {
      color: colors.cut,
      direction: [0, 0, 1],
      name: parts.eigenvectorThree,
      symbol: "\\lambda_3",
      value: scaleZ,
    },
  ] as const;

  return (
    <group>
      <ParameterSweep {...sweep} value={progress} />
      {/* The unit cube before the map */}
      {Arr.map(EDGES, ([from, to]) => (
        <Line
          color={colors.guide}
          dashed
          dashSize={STROKE_DASH.dash / 2}
          gapSize={STROKE_DASH.gap / 2}
          key={`${from}-${to}`}
          lineWidth={1.2}
          points={[CORNERS[from], CORNERS[to]]}
        />
      ))}
      <Facets color={colors.curve} edgeWidth={2} faces={faces} opacity={0.1} />
      {Arr.map(
        eigen,
        ({ color, direction: [x, y, z], name, symbol, value }) => (
          <group key={symbol}>
            {/* The span the map keeps: the eigenvector only stretches along it */}
            <Line
              color={color}
              dashed
              dashSize={STROKE_DASH.dash}
              gapSize={STROKE_DASH.gap}
              lineWidth={1.4}
              points={[
                [-x * SPAN, -y * SPAN, -z * SPAN],
                [x * SPAN, y * SPAN, z * SPAN],
              ]}
            />
            <ArrowHelper
              arrowSize={0.22}
              color={color}
              from={[0, 0, 0]}
              lineWidth={3.6}
              to={[x * value, y * value, z * value]}
            />
            <GraphTag
              anchorX={z > 0 ? "right" : "left"}
              anchorY={z > 0 ? "top" : "bottom"}
              color={color}
              gap={0.1}
              math={`${symbol} = ${quantity(value, "", 2)}`}
              name={name}
              position={[
                x * Math.max(SPAN, Math.abs(value)),
                y * Math.max(SPAN, Math.abs(value)),
                z * Math.max(SPAN, Math.abs(value)),
              ]}
            />
          </group>
        )
      )}
      <ArrowHelper
        arrowSize={0.18}
        color={colors.guide}
        from={[0, 0, 0]}
        lineWidth={1.8}
        to={[TEST.x, TEST.y, TEST.z]}
      />
      <ArrowHelper
        arrowSize={0.22}
        color={colors.accent}
        from={[0, 0, 0]}
        lineWidth={3.4}
        to={[tested.x, tested.y, tested.z]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.accent}
        gap={0.1}
        math="A\vec{x}"
        name={parts.testVector}
        position={[tested.x, tested.y, tested.z]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.curve}
        gap={0.12}
        math={`\\det A = ${quantity(state.determinant, "", 2)}`}
        name={parts.transformedGrid}
        position={[scaleX, 0, scaleZ]}
      />
    </group>
  );
}
