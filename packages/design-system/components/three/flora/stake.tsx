import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type { ScaleSchema } from "@repo/design-system/components/three/print/scale";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/** How thick the stake is, beside its width. */
const THICK = 0.18;

/** How far the stake runs on past the last mark of its scale, beside its width. */
const HEAD = 0.35;

/**
 * The stake as one solid: a straight batten of `width` that runs from its
 * point, `depth` below its zero mark, to a square head past its last mark,
 * with its corners eased as a planed batten's are.
 */
function stakeOf(width: number, length: number, depth: number) {
  const half = width / 2;
  const top = length + width * HEAD;
  const shape = new Shape();
  shape.moveTo(0, -depth);
  shape.lineTo(half, -depth + width * 1.2);
  shape.lineTo(half, top);
  shape.lineTo(-half, top);
  shape.lineTo(-half, -depth + width * 1.2);
  shape.closePath();
  const thick = width * THICK;
  const solid = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: thick * 0.18,
    bevelThickness: thick * 0.18,
    curveSegments: 4,
    depth: thick * 0.64,
  });
  solid.translate(0, 0, -thick * 0.32);
  return solid;
}

/**
 * A boxwood measuring stake pushed into the soil beside a plant, as a grower
 * reads a plant's height against: its point is buried, its zero mark lies on
 * the soil, and its face is printed with a mark at every `minor` step of its
 * scale and a larger numeral at every `major` step, so the plant beside it
 * reads at a glance. It is drawn with its zero mark at the origin, its scale
 * up +y and its printed face toward +z.
 *
 * @param depth - How far its point is pushed into the soil, below its zero mark
 * @param length - How far its scale runs above the soil, in scene units
 * @param scale - What the scale reads from the soil to its last mark
 * @param width - How wide the stake is
 */
export function Stake({
  depth,
  length,
  scale,
  width,
}: {
  readonly depth: number;
  readonly length: number;
  readonly scale: typeof ScaleSchema.Type;
  readonly width: number;
}) {
  const format = usePrintNumber();
  const solid = useMemo(
    () => stakeOf(width, length, depth),
    [depth, length, width]
  );
  useEffect(() => () => solid.dispose(), [solid]);
  const sheet = useMemo((): Sheet => {
    const height = length + width * 0.25;
    return {
      height,
      marks: ruleMarks(
        {
          from: [-width / 2, -height / 2],
          scale,
          side: -1,
          to: [-width / 2, length - height / 2],
        },
        format,
        {
          ink: FLORA_COLORS.stakeInk,
          major: width * 0.5,
          minor: width * 0.24,
          size: width * 0.34,
          turn: 0,
          width: width * 0.035,
        }
      ),
      width,
    };
  }, [format, length, scale, width]);

  return (
    <group>
      <mesh castShadow geometry={solid} receiveShadow>
        <SurfaceMaterial
          bump={0.4}
          color={FLORA_COLORS.stakeWood}
          repeat={[1, 6]}
          roughness={0.66}
          surface="wood"
        />
      </mesh>
      <group position={[0, (length + width * 0.25) / 2, width * THICK * 0.51]}>
        <PrintFace sheet={sheet} stock="engraving" />
      </group>
    </group>
  );
}
