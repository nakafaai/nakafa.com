"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { BiologyScenePoint } from "@repo/design-system/components/contents/biology/data";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group } from "three";

/**
 * Rotates an educational model slowly without hiding the first-read structure.
 */
export function RotatingGroup({
  children,
  speed = 0.18,
}: {
  children: ReactNode;
  speed?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.y += delta * speed;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Makes a structure gently expand and contract so active biological material
 * reads as alive without needing state updates.
 */
export function PulsingGroup({
  children,
  phase = 0,
  speed = 1.4,
  strength = 0.06,
}: {
  children: ReactNode;
  phase?: number;
  speed?: number;
  strength?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    const scale = 1 + Math.sin(clock.elapsedTime * speed + phase) * strength;

    ref.current.scale.setScalar(scale);
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Moves a nested structure up and down to make spores, droplets, and heat
 * indicators readable as processes instead of frozen icons.
 */
export function FloatingGroup({
  children,
  phase = 0,
  speed = 1,
  travel = 0.08,
}: {
  children: ReactNode;
  phase?: number;
  speed?: number;
  travel?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.y =
      Math.sin(clock.elapsedTime * speed + phase) * travel;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Slides a nested structure horizontally on a loop for visible transfer,
 * spread, and circulation diagrams.
 */
export function SlidingGroup({
  children,
  phase = 0,
  speed = 1,
  travel = 0.16,
}: {
  children: ReactNode;
  phase?: number;
  speed?: number;
  travel?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.x =
      Math.sin(clock.elapsedTime * speed + phase) * travel;
  });

  return <group ref={ref}>{children}</group>;
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
    <mesh position={[0, -0.9, 0]} receiveShadow scale={scale}>
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
