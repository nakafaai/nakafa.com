"use client";

import { Line } from "@react-three/drei";
import {
  resolveThreeFontSize,
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import {
  DEFAULT_INEQUALITY_RANGE_MAX,
  DEFAULT_INEQUALITY_RANGE_MIN,
  getAdaptiveInequalityResolution,
  type InequalityProps,
} from "@repo/design-system/components/three/inequality-data";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { sampleInequalityBoundary } from "@repo/design-system/lib/geometry/inequality/boundary";
import { createInequalityGeometry } from "@repo/design-system/lib/geometry/inequality/region";
import { useMemo } from "react";
import { Color, DoubleSide, MeshBasicMaterial } from "three";

const DEFAULT_LABEL_FONT_SIZE = THREE_FONT_SIZE.diagram;

/**
 * Renders 2D or 3D inequality regions with a wide boundary guide line.
 */
export function Inequality({
  boundaryFunction,
  is2D = false,
  boundaryLine2D,
  xRange = [DEFAULT_INEQUALITY_RANGE_MIN, DEFAULT_INEQUALITY_RANGE_MAX],
  yRange = [DEFAULT_INEQUALITY_RANGE_MIN, DEFAULT_INEQUALITY_RANGE_MAX],
  zRange = [DEFAULT_INEQUALITY_RANGE_MIN, DEFAULT_INEQUALITY_RANGE_MAX],
  resolution = 200,
  color = COLORS.PURPLE,
  boundaryColor,
  opacity = 0.1,
  boundaryLineWidth = 2,
  showBoundary = true,
  label,
}: InequalityProps) {
  // Adaptive resolution for performance
  const adaptiveResolution = getAdaptiveInequalityResolution(resolution);

  const geometry = useMemo(
    () =>
      createInequalityGeometry({
        is2D,
        boundaryLine2D,
        boundaryFunction,
        xRange,
        yRange,
        zRange,
        resolution: adaptiveResolution,
      }),
    [
      is2D,
      boundaryLine2D,
      boundaryFunction,
      xRange,
      yRange,
      zRange,
      adaptiveResolution,
    ]
  );

  // Material for the inequality region with performance optimizations
  const material = useMemo(() => {
    return new MeshBasicMaterial({
      color: color instanceof Color ? color : new Color(color),
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false, // Better transparency handling
    });
  }, [color, opacity]);

  const boundaryPoints = useMemo(
    () =>
      showBoundary
        ? sampleInequalityBoundary({
            is2D,
            boundaryLine2D,
            boundaryFunction,
            xRange,
            yRange,
            zRange,
            resolution: adaptiveResolution,
          })
        : [],
    [
      showBoundary,
      adaptiveResolution,
      boundaryFunction,
      boundaryLine2D,
      is2D,
      xRange,
      yRange,
      zRange,
    ]
  );

  // Default boundary color is the same as the region color but more opaque
  const finalBoundaryColor = boundaryColor || color;

  return (
    <group frustumCulled>
      {/* Render the shaded region */}
      <mesh frustumCulled geometry={geometry} material={material} />

      {/* Drei Line uses Line2, unlike LineBasicMaterial linewidth in WebGL. */}
      {boundaryPoints.length > 0 && (
        <Line
          color={finalBoundaryColor}
          frustumCulled
          lineWidth={boundaryLineWidth}
          points={boundaryPoints}
          segments
        />
      )}

      {/* Render label if provided */}
      {!!label && (
        <ThreeLabel
          anchorX="center"
          color={label.color || finalBoundaryColor}
          fontSize={resolveThreeFontSize(
            label.fontSize ?? DEFAULT_LABEL_FONT_SIZE
          )}
          minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
          position={label.position}
        >
          {label.text}
        </ThreeLabel>
      )}
    </group>
  );
}
