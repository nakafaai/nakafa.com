"use client";

import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

/** Renders one bacterial wall stack with visible layer count. */
export function BacterialWallStack({
  colors,
  label,
  textColor,
  x,
}: {
  colors: readonly string[];
  label: ReactNode;
  textColor: string;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      {colors.map((color, index) => {
        const radius = 0.25 - index * 0.035;
        const length = 0.8 - index * 0.08;
        const opacity = index === colors.length - 1 ? 0.78 : 0.34;

        return (
          <mesh
            key={`${x}-${color}`}
            position={[0, 0.02, index * 0.055]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <capsuleGeometry args={[radius, length, 10, 24]} />
            <meshStandardMaterial
              color={color}
              opacity={opacity}
              roughness={0.82}
              transparent
            />
          </mesh>
        );
      })}
      <ThreeLabel
        color={textColor}
        fontSize="compact"
        position={[0, 0.44, 0.72]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}
