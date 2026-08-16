"use client";

import { Line } from "@react-three/drei";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { type ComponentProps, useMemo } from "react";
import { Vector3 } from "three";

/**
 * Renders the shared X/Y/Z axes and labels for educational 3D scenes.
 */
export function Axes({
  size = 10,
  showLabels = true,
  showZAxis = true,
  labelSize = "diagram",
  labelOffset = 0.5,
  ...props
}: {
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  labelSize?: ThreeFontSize | number;
  labelOffset?: number;
} & ComponentProps<"group">) {
  // Create points for each axis (now extending in both positive and negative directions)
  const xPoints = useMemo(
    () => [new Vector3(-size, 0, 0), new Vector3(size, 0, 0)],
    [size]
  );

  const yPoints = useMemo(
    () => [new Vector3(0, -size, 0), new Vector3(0, size, 0)],
    [size]
  );

  const zPoints = useMemo(
    () => [new Vector3(0, 0, -size), new Vector3(0, 0, size)],
    [size]
  );

  // Memoize label positions to avoid recreating them
  const labelPositions = useMemo(() => {
    const offset = size + labelOffset;
    return {
      xPos: new Vector3(offset, 0, 0),
      xNeg: new Vector3(-offset, 0, 0),
      yPos: new Vector3(0, offset, 0),
      yNeg: new Vector3(0, -offset, 0),
      zPos: new Vector3(0, 0, offset),
      zNeg: new Vector3(0, 0, -offset),
    };
  }, [size, labelOffset]);

  return (
    <group frustumCulled {...props}>
      {/* Axis lines with frustum culling */}
      <Line color={COLORS.RED} frustumCulled lineWidth={2} points={xPoints} />
      <Line color={COLORS.GREEN} frustumCulled lineWidth={2} points={yPoints} />
      <Line
        color={COLORS.BLUE}
        frustumCulled
        lineWidth={2}
        points={zPoints}
        visible={showZAxis}
      />

      {/* X-axis labels */}
      <ThreeLabel
        anchorX="left"
        color={COLORS.RED}
        fontSize={labelSize}
        position={labelPositions.xPos}
        visible={showLabels}
      >
        <InlineMath math="X" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={COLORS.RED}
        fontSize={labelSize}
        position={labelPositions.xNeg}
        visible={showLabels}
      >
        <InlineMath math="-X" />
      </ThreeLabel>

      {/* Y-axis labels */}
      <ThreeLabel
        anchorX="left"
        color={COLORS.GREEN}
        fontSize={labelSize}
        position={labelPositions.yPos}
        visible={showLabels}
      >
        <InlineMath math="Y" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={COLORS.GREEN}
        fontSize={labelSize}
        position={labelPositions.yNeg}
        visible={showLabels}
      >
        <InlineMath math="-Y" />
      </ThreeLabel>

      {/* Z-axis labels */}
      <ThreeLabel
        anchorX="left"
        color={COLORS.BLUE}
        fontSize={labelSize}
        position={labelPositions.zPos}
        visible={!!showZAxis && !!showLabels}
      >
        <InlineMath math="Z" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={COLORS.BLUE}
        fontSize={labelSize}
        position={labelPositions.zNeg}
        visible={!!showZAxis && !!showLabels}
      >
        <InlineMath math="-Z" />
      </ThreeLabel>
    </group>
  );
}
