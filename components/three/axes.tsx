"use client";

import { COLORS } from "@/lib/utils/color";
import { Line, Text } from "@react-three/drei";
import { type ComponentProps, useMemo } from "react";
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

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

  return (
    <group {...props}>
      <Line points={xPoints} color={COLORS.RED} lineWidth={2} />
      <Line points={yPoints} color={COLORS.GREEN} lineWidth={2} />
      <Line
        visible={showZAxis}
        points={zPoints}
        color={COLORS.BLUE}
        lineWidth={2}
      />

      <Text
        visible={showLabels}
        position={[size + labelOffset, 0, 0]}
        color={COLORS.RED}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        X
      </Text>
      <Text
        visible={showLabels}
        position={[-size - labelOffset, 0, 0]}
        color={COLORS.RED}
        fontSize={labelSize}
        anchorX="right"
        font={fontToUse}
      >
        -X
      </Text>
      <Text
        visible={showLabels}
        position={[0, size + labelOffset, 0]}
        color={COLORS.GREEN}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        Y
      </Text>
      <Text
        visible={showLabels}
        position={[0, -size - labelOffset, 0]}
        color={COLORS.GREEN}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        -Y
      </Text>

      <Text
        visible={showZAxis && showLabels}
        position={[0, 0, size + labelOffset]}
        color={COLORS.BLUE}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        Z
      </Text>
      <Text
        visible={showZAxis && showLabels}
        position={[0, 0, -size - labelOffset]}
        color={COLORS.BLUE}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        -Z
      </Text>
    </group>
  );
}
