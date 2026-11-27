import { Line } from "@react-three/drei";
import type { BoxSheet } from "@repo/design-system/components/contents/mathematics/optimize/model";
import {
  BOX_SHEETS,
  evaluateOptimizationBox,
} from "@repo/design-system/components/contents/mathematics/optimize/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { Facets } from "@repo/design-system/components/three/facets";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/**
 * World units of one unit of the sheet on every axis. The lab passes the
 * same scale to its coordinate system, so every tick reads the true length.
 */
export const OPTIMIZE_SCALE = { x: 0.42, y: 0.42, z: 0.42 } as const;
const UNIT = OPTIMIZE_SCALE.x;
/** How far the cut corners lie above the floor, so the grid under them never shows through as a flicker. */
const LIFT = 0.004;
/** The four corners of the sheet, as the sign of each one's X and Z. */
const CORNERS = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
] as const;

/**
 * The sheet and the open box folded from it, to scale: the outline of the
 * flat sheet, the square cut from each of its corners, and the box whose
 * walls stand as high as the cut is deep.
 */
export function OptimizationBox3DScene({
  cutout,
  parts,
  sheet,
  sweep,
}: {
  readonly cutout: number;
  readonly parts: Readonly<
    Record<"basePlate" | "cornerCutouts" | "sideFlaps", string>
  >;
  readonly sheet: BoxSheet;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const box = evaluateOptimizationBox(sheet, cutout);
  const size = BOX_SHEETS[sheet];
  const halfLength = (size.length / 2) * UNIT;
  const halfWidth = (size.width / 2) * UNIT;
  const baseX = (box.baseLength / 2) * UNIT;
  const baseZ = (box.baseWidth / 2) * UNIT;
  const height = (size.length / 2) * UNIT - baseX;

  const { base, cuts, walls } = useMemo(() => {
    const floor = Arr.map(CORNERS, ([x, z]) => ({
      x: x * baseX,
      y: 0,
      z: z * baseZ,
    }));
    const rim = Arr.map(floor, (corner) => ({ ...corner, y: height }));
    return {
      base: [floor],
      cuts: Arr.map(CORNERS, ([x, z]) => [
        { x: x * baseX, y: LIFT, z: z * baseZ },
        { x: x * halfLength, y: LIFT, z: z * baseZ },
        { x: x * halfLength, y: LIFT, z: z * halfWidth },
        { x: x * baseX, y: LIFT, z: z * halfWidth },
      ]),
      walls: Arr.map(CORNERS, (_, index) => {
        const next = (index + 1) % CORNERS.length;
        return [
          floor[index] ?? floor[0],
          floor[next] ?? floor[0],
          rim[next] ?? rim[0],
          rim[index] ?? rim[0],
        ];
      }),
    };
  }, [baseX, baseZ, halfLength, halfWidth, height]);

  return (
    <group>
      <ParameterSweep {...sweep} value={cutout} />
      {/* The flat sheet the box is folded from */}
      <Line
        color={colors.guide}
        dashed
        dashSize={STROKE_DASH.dash}
        gapSize={STROKE_DASH.gap}
        lineWidth={1.8}
        points={Arr.map([...CORNERS, CORNERS[0]], ([x, z]) => [
          x * halfLength,
          LIFT,
          z * halfWidth,
        ])}
      />
      <Facets
        color={colors.alert}
        edgeWidth={1.6}
        faces={cuts}
        opacity={0.22}
      />
      <Facets color={colors.curve} edgeWidth={2.2} faces={base} opacity={0.3} />
      <Facets color={colors.accent} edgeWidth={2.2} faces={walls} />
      <GraphTag
        anchorX="right"
        anchorY="top"
        color={colors.curve}
        gap={0.12}
        math={`${quantity(box.baseLength, "", 2)} \\times ${quantity(box.baseWidth, "", 2)}`}
        name={parts.basePlate}
        position={[-halfLength, 0, halfWidth]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.accent}
        gap={0.12}
        math={`x = ${quantity(cutout, "", 2)}`}
        name={parts.sideFlaps}
        position={[baseX, height, -baseZ]}
      />
      <GraphTag
        anchorX="left"
        anchorY="middle"
        color={colors.alert}
        gap={0.12}
        math="x \times x"
        name={parts.cornerCutouts}
        position={[halfLength, 0, (halfWidth + baseZ) / 2]}
      />
    </group>
  );
}
