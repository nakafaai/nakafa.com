import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type {
  RiemannCurve,
  RiemannMethod,
} from "@repo/design-system/components/contents/mathematics/riemann/model";
import { sampleRiemannCurve } from "@repo/design-system/components/contents/mathematics/riemann/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { Facets } from "@repo/design-system/components/three/facets";
import { LineEquation } from "@repo/design-system/components/three/line";
import { GraphMarker } from "@repo/design-system/components/three/marker";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/**
 * World units of one mathematical unit on each axis. The lab passes the same
 * scale to its coordinate system, so every tick reads the true value.
 */
export const RIEMANN_SCALE = { x: 2, y: 1, z: 1 } as const;
/** The interval the sum covers. */
const DOMAIN = { max: 2, min: 0 };
/** Half of the depth each slab stands out of the plane of the curve. */
const HALF_DEPTH = 0.3;
const SAMPLES = 160;

/** Where one slab reads the curve: at its left end, its right end, both, or its middle. */
function sampleXs(method: RiemannMethod, x0: number, x1: number) {
  if (method === "left") {
    return [x0];
  }
  if (method === "right") {
    return [x1];
  }
  return method === "midpoint" ? [(x0 + x1) / 2] : [x0, x1];
}

/** The six faces of one slab: a box, or under the trapezoid rule a wedge with a slanted top. */
function slab(x0: number, x1: number, left: number, right: number) {
  const corner = (x: number, y: number, z: number) => ({
    x: x * RIEMANN_SCALE.x,
    y,
    z,
  });
  const front = [
    corner(x0, 0, HALF_DEPTH),
    corner(x1, 0, HALF_DEPTH),
    corner(x1, right, HALF_DEPTH),
    corner(x0, left, HALF_DEPTH),
  ] as const;
  const back = [
    corner(x0, 0, -HALF_DEPTH),
    corner(x1, 0, -HALF_DEPTH),
    corner(x1, right, -HALF_DEPTH),
    corner(x0, left, -HALF_DEPTH),
  ] as const;
  return [
    front,
    back,
    [front[0], front[1], back[1], back[0]],
    [front[3], front[2], back[2], back[3]],
    [front[0], front[3], back[3], back[0]],
    [front[1], front[2], back[2], back[1]],
  ];
}

export function RiemannSumConvergenceScene({
  curve,
  method,
  partitions,
  parts,
  sweep,
}: {
  readonly curve: RiemannCurve;
  readonly method: RiemannMethod;
  readonly partitions: number;
  readonly parts: Readonly<
    Record<
      | "baseAxis"
      | "curveSurface"
      | "exactArea"
      | "riemannPrisms"
      | "samplePoints",
      string
    >
  >;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const count = Math.max(1, Math.round(partitions));
  const width = (DOMAIN.max - DOMAIN.min) / count;

  const curvePoints = useMemo(
    () =>
      Arr.makeBy(SAMPLES + 1, (i) => {
        const x = DOMAIN.min + (i / SAMPLES) * (DOMAIN.max - DOMAIN.min);
        return {
          x: x * RIEMANN_SCALE.x,
          y: sampleRiemannCurve(curve, x),
          z: HALF_DEPTH,
        };
      }),
    [curve]
  );
  // The exact area under the curve, in the plane the curve is drawn in.
  const region = useMemo(
    () => [
      { x: DOMAIN.min * RIEMANN_SCALE.x, y: 0, z: HALF_DEPTH },
      ...curvePoints,
      { x: DOMAIN.max * RIEMANN_SCALE.x, y: 0, z: HALF_DEPTH },
    ],
    [curvePoints]
  );
  const slabs = useMemo(
    () =>
      Arr.makeBy(count, (i) => {
        const x0 = DOMAIN.min + i * width;
        const x1 = x0 + width;
        const samples = Arr.map(sampleXs(method, x0, x1), (x) => ({
          x,
          y: sampleRiemannCurve(curve, x),
        }));
        const left = Arr.headNonEmpty(
          Arr.appendAll(samples, [{ x: x0, y: 0 }])
        );
        const right = Arr.lastNonEmpty(Arr.prepend(samples, left));
        return { faces: slab(x0, x1, left.y, right.y), samples, x0 };
      }),
    [count, curve, method, width]
  );
  const faces = useMemo(() => Arr.flatMap(slabs, (one) => one.faces), [slabs]);
  const end = sampleRiemannCurve(curve, DOMAIN.max);
  const firstSample = Arr.headNonEmpty(
    Arr.appendAll(
      Arr.flatMap(slabs, (one) => one.samples),
      [{ x: DOMAIN.min, y: 0 }]
    )
  );

  return (
    <group>
      <ParameterSweep {...sweep} value={partitions} />
      <Polygon color={colors.slope} opacity={0.16} vertices={region} />
      <Facets
        color={colors.plane}
        edgeWidth={1.6}
        faces={faces}
        opacity={0.2}
      />
      <LineEquation
        color={colors.curve}
        lineWidth={3.4}
        points={curvePoints}
        showPoints={false}
      />
      {Arr.flatMap(slabs, (one) =>
        Arr.map(one.samples, (sample) => (
          <GraphMarker
            color={colors.accent}
            key={`${one.x0}-${sample.x}`}
            position={[sample.x * RIEMANN_SCALE.x, sample.y, HALF_DEPTH]}
            radius={0.05}
          />
        ))
      )}
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.curve}
        gap={0.1}
        math="y = f(x)"
        name={parts.curveSurface}
        position={[DOMAIN.max * RIEMANN_SCALE.x, end, HALF_DEPTH]}
      />
      <GraphTag
        anchorX="left"
        anchorY="middle"
        color={colors.plane}
        gap={0.14}
        math="\sum f(x_i^*)\,\Delta x"
        name={parts.riemannPrisms}
        position={[DOMAIN.max * RIEMANN_SCALE.x, end / 2, HALF_DEPTH]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.slope}
        gap={0.14}
        math="\int_0^2 f(x)\,dx"
        name={parts.exactArea}
        position={[DOMAIN.max * RIEMANN_SCALE.x, 0, HALF_DEPTH]}
      />
      <GraphTag
        anchorX="center"
        anchorY="bottom"
        color={colors.accent}
        gap={0.16}
        math="x_i^*"
        name={parts.samplePoints}
        position={[firstSample.x * RIEMANN_SCALE.x, firstSample.y, HALF_DEPTH]}
      />
      <GraphTag
        anchorX="center"
        anchorY="top"
        color={colors.guide}
        gap={0.4}
        math={`\\Delta x = ${quantity(width, "", 2)}`}
        name={parts.baseAxis}
        position={[(width / 2) * RIEMANN_SCALE.x, 0, HALF_DEPTH]}
      />
    </group>
  );
}
