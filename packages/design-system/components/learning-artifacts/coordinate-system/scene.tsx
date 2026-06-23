"use client";

import { FunctionPrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/function";
import { LinearPrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/linear";
import { ClosedPrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/solid";
import { SurfacePrimitive } from "@repo/design-system/components/learning-artifacts/coordinate-system/surface";
import type { CoordinateSystemPayload } from "@repo/math/schema/artifact/schema";

const PRIMITIVE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
];

/**
 * Renders the validated coordinate primitive list inside the shared 3D scene.
 */
export function CoordinateArtifactScene({
  payload,
  size,
}: {
  payload: CoordinateSystemPayload;
  size: number;
}) {
  return (
    <>
      {payload.primitives.map((primitive, index) => {
        const color = readPrimitiveColor(index);
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
function readPrimitiveColor(index: number) {
  return PRIMITIVE_COLORS[index % PRIMITIVE_COLORS.length] ?? "#2563eb";
}
