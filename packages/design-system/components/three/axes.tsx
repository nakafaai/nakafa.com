"use client";

import { Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { COLORS } from "@repo/design-system/lib/color";
import { type ComponentProps, useMemo, useRef } from "react";
import { type Group, MeshBasicMaterial, Vector3 } from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

// Shared materials cache for text components
const textMaterialCache = new Map<string, MeshBasicMaterial>();

function getTextMaterial(color: string): MeshBasicMaterial {
  if (!textMaterialCache.has(color)) {
    textMaterialCache.set(color, new MeshBasicMaterial({ color }));
  }
  const material = textMaterialCache.get(color);
  if (!material) {
    throw new Error(`Text material not found for color: ${color}`);
  }
  return material;
}

export function Axes({
  size = 10,
  showLabels = true,
  showZAxis = true,
  labelSize = 0.5,
  labelOffset = 0.5,
  font = "mono",
  ...props
}: {
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  labelSize?: number;
  labelOffset?: number;
  font?: "mono" | "sans";
} & ComponentProps<"group">) {
  const groupRef = useRef<Group>(null);

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

  // Memoize label positions to avoid recreating them
  const labelPositions = useMemo(() => {
    const offset = size + labelOffset;
    return {
      xPos: [offset, 0, 0] as [number, number, number],
      xNeg: [-offset, 0, 0] as [number, number, number],
      yPos: [0, offset, 0] as [number, number, number],
      yNeg: [0, -offset, 0] as [number, number, number],
      zPos: [0, 0, offset] as [number, number, number],
      zNeg: [0, 0, -offset] as [number, number, number],
    };
  }, [size, labelOffset]);

  // Enable frustum culling for the entire group
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.frustumCulled = true;
    }
  });

  // Get shared materials for text
  const redMaterial = getTextMaterial(COLORS.RED);
  const greenMaterial = getTextMaterial(COLORS.GREEN);
  const blueMaterial = getTextMaterial(COLORS.BLUE);

  return (
    <group ref={groupRef} {...props}>
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
        fontSize={labelSize}
        frustumCulled
        material={redMaterial}
        position={labelPositions.xPos}
        visible={showLabels}
      >
        X
      </Text>
      <Text
        anchorX="right"
        color={COLORS.RED}
        font={fontToUse}
        fontSize={labelSize}
        frustumCulled
        material={redMaterial}
        position={labelPositions.xNeg}
        visible={showLabels}
      >
        -X
      </Text>

      {/* Y-axis labels */}
      <Text
        anchorX="left"
        color={COLORS.GREEN}
        font={fontToUse}
        fontSize={labelSize}
        frustumCulled
        material={greenMaterial}
        position={labelPositions.yPos}
        visible={showLabels}
      >
        Y
      </Text>
      <Text
        anchorX="left"
        color={COLORS.GREEN}
        font={fontToUse}
        fontSize={labelSize}
        frustumCulled
        material={greenMaterial}
        position={labelPositions.yNeg}
        visible={showLabels}
      >
        -Y
      </Text>

      {/* Z-axis labels */}
      <Text
        anchorX="left"
        color={COLORS.BLUE}
        font={fontToUse}
        fontSize={labelSize}
        frustumCulled
        material={blueMaterial}
        position={labelPositions.zPos}
        visible={showZAxis && showLabels}
      >
        Z
      </Text>
      <Text
        anchorX="left"
        color={COLORS.BLUE}
        font={fontToUse}
        fontSize={labelSize}
        frustumCulled
        material={blueMaterial}
        position={labelPositions.zNeg}
        visible={showZAxis && showLabels}
      >
        -Z
      </Text>
    </group>
  );
}
