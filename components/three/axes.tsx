"use client";

import { COLORS } from "@/lib/utils/color";
import { Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ComponentProps, useMemo, useRef } from "react";
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

// Shared materials cache for text components
const textMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

function getTextMaterial(color: string): THREE.MeshBasicMaterial {
  if (!textMaterialCache.has(color)) {
    textMaterialCache.set(color, new THREE.MeshBasicMaterial({ color }));
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
  const groupRef = useRef<THREE.Group>(null);

  // Create points for each axis (now extending in both positive and negative directions)
  const xPoints = useMemo(
    () => [new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0)],
    [size]
  );

  const yPoints = useMemo(
    () => [new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0)],
    [size]
  );

  const zPoints = useMemo(
    () => [new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size)],
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
      <Line points={xPoints} color={COLORS.RED} lineWidth={2} frustumCulled />
      <Line points={yPoints} color={COLORS.GREEN} lineWidth={2} frustumCulled />
      <Line
        visible={showZAxis}
        points={zPoints}
        color={COLORS.BLUE}
        lineWidth={2}
        frustumCulled
      />

      {/* X-axis labels */}
      <Text
        visible={showLabels}
        position={labelPositions.xPos}
        color={COLORS.RED}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
        frustumCulled
        material={redMaterial}
      >
        X
      </Text>
      <Text
        visible={showLabels}
        position={labelPositions.xNeg}
        color={COLORS.RED}
        fontSize={labelSize}
        anchorX="right"
        font={fontToUse}
        frustumCulled
        material={redMaterial}
      >
        -X
      </Text>

      {/* Y-axis labels */}
      <Text
        visible={showLabels}
        position={labelPositions.yPos}
        color={COLORS.GREEN}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
        frustumCulled
        material={greenMaterial}
      >
        Y
      </Text>
      <Text
        visible={showLabels}
        position={labelPositions.yNeg}
        color={COLORS.GREEN}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
        frustumCulled
        material={greenMaterial}
      >
        -Y
      </Text>

      {/* Z-axis labels */}
      <Text
        visible={showZAxis && showLabels}
        position={labelPositions.zPos}
        color={COLORS.BLUE}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
        frustumCulled
        material={blueMaterial}
      >
        Z
      </Text>
      <Text
        visible={showZAxis && showLabels}
        position={labelPositions.zNeg}
        color={COLORS.BLUE}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
        frustumCulled
        material={blueMaterial}
      >
        -Z
      </Text>
    </group>
  );
}
