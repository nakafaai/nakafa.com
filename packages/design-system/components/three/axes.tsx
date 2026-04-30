"use client";

import { Line, Text } from "@react-three/drei";
import {
  FONT_PATH,
  MONO_FONT_PATH,
  resolveThreeFontSize,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import { COLORS } from "@repo/design-system/lib/color";
import { type ComponentProps, useMemo } from "react";
import { MeshBasicMaterial, Vector3 } from "three";

// Shared materials cache for text components
const textMaterialCache = new Map<string, MeshBasicMaterial>();

/**
 * Reuses text materials per axis color across repeated coordinate systems.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getTextMaterial(color: string): MeshBasicMaterial {
  if (!textMaterialCache.has(color)) {
    textMaterialCache.set(
      color,
      new MeshBasicMaterial({ color, depthTest: false })
    );
  }
  const material = textMaterialCache.get(color);
  if (!material) {
    throw new Error(`Text material not found for color: ${color}`);
  }
  return material;
}

/**
 * Renders the shared X/Y/Z axes and labels for educational 3D scenes.
 */
export function Axes({
  size = 10,
  showLabels = true,
  showZAxis = true,
  labelSize = "diagram",
  labelOffset = 0.5,
  font = "mono",
  ...props
}: {
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  labelSize?: ThreeFontSize | number;
  labelOffset?: number;
  font?: "mono" | "sans";
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

  const fontToUse = font === "mono" ? MONO_FONT_PATH : FONT_PATH;
  const resolvedLabelSize = resolveThreeFontSize(labelSize);

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

  // Get shared materials for text
  const redMaterial = getTextMaterial(COLORS.RED);
  const greenMaterial = getTextMaterial(COLORS.GREEN);
  const blueMaterial = getTextMaterial(COLORS.BLUE);

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
      <Text
        anchorX="left"
        color={COLORS.RED}
        font={fontToUse}
        fontSize={resolvedLabelSize}
        frustumCulled={false}
        material={redMaterial}
        position={labelPositions.xPos}
        renderOrder={10}
        visible={showLabels}
      >
        X
      </Text>
      <Text
        anchorX="right"
        color={COLORS.RED}
        font={fontToUse}
        fontSize={resolvedLabelSize}
        frustumCulled={false}
        material={redMaterial}
        position={labelPositions.xNeg}
        renderOrder={10}
        visible={showLabels}
      >
        -X
      </Text>

      {/* Y-axis labels */}
      <Text
        anchorX="left"
        color={COLORS.GREEN}
        font={fontToUse}
        fontSize={resolvedLabelSize}
        frustumCulled={false}
        material={greenMaterial}
        position={labelPositions.yPos}
        renderOrder={10}
        visible={showLabels}
      >
        Y
      </Text>
      <Text
        anchorX="left"
        color={COLORS.GREEN}
        font={fontToUse}
        fontSize={resolvedLabelSize}
        frustumCulled={false}
        material={greenMaterial}
        position={labelPositions.yNeg}
        renderOrder={10}
        visible={showLabels}
      >
        -Y
      </Text>

      {/* Z-axis labels */}
      <Text
        anchorX="left"
        color={COLORS.BLUE}
        font={fontToUse}
        fontSize={resolvedLabelSize}
        frustumCulled={false}
        material={blueMaterial}
        position={labelPositions.zPos}
        renderOrder={10}
        visible={!!showZAxis && !!showLabels}
      >
        Z
      </Text>
      <Text
        anchorX="left"
        color={COLORS.BLUE}
        font={fontToUse}
        fontSize={resolvedLabelSize}
        frustumCulled={false}
        material={blueMaterial}
        position={labelPositions.zNeg}
        renderOrder={10}
        visible={!!showZAxis && !!showLabels}
      >
        -Z
      </Text>
    </group>
  );
}
