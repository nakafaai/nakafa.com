import { LineEquation } from "@repo/design-system/components/three/line";
import { Origin } from "@repo/design-system/components/three/origin";
import { Region } from "@repo/design-system/components/three/region";
import { Solid } from "@repo/design-system/components/three/solid";
import { Surface } from "@repo/design-system/components/three/surface";
import { Array as Arr } from "effect";
import type { FormulaShape } from "@/lib/content/renderer/client/base/visual/formula";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";

/** Draws one formula shape with the design system's primitive for its kind. */
function FormulaShapeView({ shape }: { readonly shape: FormulaShape }) {
  const color = resolveMathAppearance(shape.appearance);
  if (shape.kind === "curve") {
    return (
      <LineEquation
        color={color}
        points={[...shape.points]}
        showPoints={false}
        smooth={false}
      />
    );
  }
  if (shape.kind === "marker") {
    const { x, y, z } = shape.point;
    return <Origin color={color} position={[x, y, z]} size={0.125} />;
  }
  if (shape.kind === "region") {
    return <Region boundary={shape.boundary} color={color} fill={shape.fill} />;
  }
  if (shape.kind === "surface") {
    return (
      <Surface color={color} grid={shape.grid} max={shape.max} min={shape.min} />
    );
  }
  return <Solid color={color} faces={shape.faces} />;
}

/** Draws every shape that a scene's formula objects sampled. */
export function FormulaShapes({
  shapes,
}: {
  readonly shapes: readonly FormulaShape[];
}) {
  return Arr.map(shapes, (shape) => (
    <FormulaShapeView key={shape.id} shape={shape} />
  ));
}
