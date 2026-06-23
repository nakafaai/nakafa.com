"use client";

import { FunctionPrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/function";
import { LinearPrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/linear";
import type {
  CoordinatePrimitiveView,
  CoordinateSystemPayloadView,
} from "@repo/design-system/components/learning-artifacts/coordinate-system/model/view";
import { ClosedPrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/solid";
import { SurfacePrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/surface";
import { getColor, randomColor } from "@repo/design-system/lib/color";

/**
 * Renders the validated coordinate primitive list inside the shared 3D scene.
 */
export function CoordinateArtifactScene({
  payload,
  size,
}: {
  payload: CoordinateSystemPayloadView;
  size: number;
}) {
  return (
    <>
      {payload.primitives.map((primitive, index) => {
        const color = readPrimitiveColor(primitive.kind, index);
        switch (primitive.kind) {
          case "parametric-curve":
          case "function-surface":
          case "parametric-surface":
            return (
              <FunctionPrimitive
                color={color}
                key={primitive.id}
                primitive={primitive}
                sampling={payload.sampling}
              />
            );
          case "point":
          case "vector":
          case "segment":
          case "ray":
          case "line":
            return (
              <LinearPrimitive
                color={color}
                key={primitive.id}
                primitive={primitive}
                size={size}
              />
            );
          case "plane":
          case "polygon":
            return (
              <SurfacePrimitive
                color={color}
                key={primitive.id}
                primitive={primitive}
                size={size}
              />
            );
          default:
            return (
              <ClosedPrimitive
                color={color}
                key={primitive.id}
                primitive={primitive}
              />
            );
        }
      })}
    </>
  );
}

/**
 * Assigns stable visual colors by primitive order without model-controlled CSS.
 */
function readPrimitiveColor(
  kind: CoordinatePrimitiveView["kind"],
  index: number
) {
  if (kind === "line" || kind === "ray" || kind === "segment") {
    return getColor("ORANGE");
  }

  if (kind === "vector") {
    return getColor("CYAN");
  }

  return randomColor(["YELLOW"], `${kind}:${index}`);
}
