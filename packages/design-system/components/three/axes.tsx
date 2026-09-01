"use client";

import { Line } from "@react-three/drei";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import {
  type CoordinateFrame,
  createAxisGeometry,
  createSymmetricFrame,
} from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { type ComponentProps, useMemo } from "react";
import { Vector3 } from "three";

/**
 * Renders the shared X/Y/Z axes and labels for educational 3D scenes.
 */
export function Axes({
  size = 10,
  frame,
  showLabels = true,
  showZAxis = true,
  labelSize = "diagram",
  labelOffset = 0.5,
  ...props
}: {
  frame?: CoordinateFrame;
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  labelSize?: ThreeFontSize | number;
  labelOffset?: number;
} & ComponentProps<"group">) {
  const geometry = useMemo(
    () => createAxisGeometry(frame ?? createSymmetricFrame(size), labelOffset),
    [frame, labelOffset, size]
  );
  const vectors = useMemo(
    () => ({
      x: [
        new Vector3(geometry.x.from.x, geometry.x.from.y, geometry.x.from.z),
        new Vector3(geometry.x.to.x, geometry.x.to.y, geometry.x.to.z),
      ],
      y: [
        new Vector3(geometry.y.from.x, geometry.y.from.y, geometry.y.from.z),
        new Vector3(geometry.y.to.x, geometry.y.to.y, geometry.y.to.z),
      ],
      z: [
        new Vector3(geometry.z.from.x, geometry.z.from.y, geometry.z.from.z),
        new Vector3(geometry.z.to.x, geometry.z.to.y, geometry.z.to.z),
      ],
    }),
    [geometry]
  );

  const vector = (point: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => new Vector3(point.x, point.y, point.z);

  return (
    <group frustumCulled {...props}>
      {/* Axis lines with frustum culling */}
      <Line
        color={COLORS.RED}
        frustumCulled
        lineWidth={2}
        points={vectors.x}
        visible={geometry.x.visible}
      />
      <Line
        color={COLORS.GREEN}
        frustumCulled
        lineWidth={2}
        points={vectors.y}
        visible={geometry.y.visible}
      />
      <Line
        color={COLORS.BLUE}
        frustumCulled
        lineWidth={2}
        points={vectors.z}
        visible={showZAxis && geometry.z.visible}
      />

      {/* X-axis labels */}
      <ThreeLabel
        anchorX="left"
        color={COLORS.RED}
        fontSize={labelSize}
        position={
          geometry.x.positiveLabel
            ? vector(geometry.x.positiveLabel)
            : undefined
        }
        visible={geometry.x.visible && showLabels && !!geometry.x.positiveLabel}
      >
        <InlineMath math="X" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={COLORS.RED}
        fontSize={labelSize}
        position={
          geometry.x.negativeLabel
            ? vector(geometry.x.negativeLabel)
            : undefined
        }
        visible={geometry.x.visible && showLabels && !!geometry.x.negativeLabel}
      >
        <InlineMath math="-X" />
      </ThreeLabel>

      {/* Y-axis labels */}
      <ThreeLabel
        anchorX="left"
        color={COLORS.GREEN}
        fontSize={labelSize}
        position={
          geometry.y.positiveLabel
            ? vector(geometry.y.positiveLabel)
            : undefined
        }
        visible={geometry.y.visible && showLabels && !!geometry.y.positiveLabel}
      >
        <InlineMath math="Y" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={COLORS.GREEN}
        fontSize={labelSize}
        position={
          geometry.y.negativeLabel
            ? vector(geometry.y.negativeLabel)
            : undefined
        }
        visible={geometry.y.visible && showLabels && !!geometry.y.negativeLabel}
      >
        <InlineMath math="-Y" />
      </ThreeLabel>

      {/* Z-axis labels */}
      <ThreeLabel
        anchorX="left"
        color={COLORS.BLUE}
        fontSize={labelSize}
        position={
          geometry.z.positiveLabel
            ? vector(geometry.z.positiveLabel)
            : undefined
        }
        visible={
          geometry.z.visible &&
          !!showZAxis &&
          !!showLabels &&
          !!geometry.z.positiveLabel
        }
      >
        <InlineMath math="Z" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={COLORS.BLUE}
        fontSize={labelSize}
        position={
          geometry.z.negativeLabel
            ? vector(geometry.z.negativeLabel)
            : undefined
        }
        visible={
          geometry.z.visible &&
          !!showZAxis &&
          !!showLabels &&
          !!geometry.z.negativeLabel
        }
      >
        <InlineMath math="-Z" />
      </ThreeLabel>
    </group>
  );
}
