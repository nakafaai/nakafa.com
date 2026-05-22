"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { BiologyScenePoint } from "@repo/design-system/components/contents/biology/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group } from "three";

/**
 * Rotates an educational model slowly without hiding the first-read structure.
 */
export function RotatingGroup({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.y += delta * 0.18;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Renders a compact model label above the active biology scene.
 */
export function BiologySceneTitle({
  children,
  color,
  y = 1.65,
}: {
  children: string;
  color: string;
  y?: number;
}) {
  return (
    <SceneLabel color={color} fontSize="annotation" position={[0, y, 0]}>
      {children}
    </SceneLabel>
  );
}

/**
 * Renders a theme-aware base plane for scenes that need environmental context.
 */
export function BiologyGround({
  color,
  scale = [3.8, 0.08, 2.4],
}: {
  color: string;
  scale?: BiologyScenePoint;
}) {
  return (
    <mesh position={[0, -0.9, 0]} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} opacity={0.26} transparent />
    </mesh>
  );
}

/**
 * Draws a curved-looking path from stable points without custom geometry.
 */
export function BiologyLine({
  color,
  lineWidth = 2,
  points,
}: {
  color: string;
  lineWidth?: number;
  points: readonly BiologyScenePoint[];
}) {
  return <Line color={color} lineWidth={lineWidth} points={points} />;
}
