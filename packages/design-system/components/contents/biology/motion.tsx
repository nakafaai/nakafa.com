"use client";

import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { type ReactNode, useRef } from "react";
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

  return (
    <CameraBounds motion={{ rotation: "y" }} objectRef={ref}>
      {children}
    </CameraBounds>
  );
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
  const timeRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    timeRef.current += delta * speed;

    const scale = 1 + Math.sin(timeRef.current) * strength;

    ref.current.scale.setScalar(scale);
  });

  return (
    <CameraBounds motion={{ scale: 1 + Math.abs(strength) }} objectRef={ref}>
      {children}
    </CameraBounds>
  );
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
  const timeRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    timeRef.current += delta * speed;
    ref.current.position.y = Math.sin(timeRef.current) * travel;
  });

  return (
    <CameraBounds
      motion={{
        translation: {
          x: { min: 0, max: 0 },
          y: { min: -Math.abs(travel), max: Math.abs(travel) },
          z: { min: 0, max: 0 },
        },
      }}
      objectRef={ref}
    >
      {children}
    </CameraBounds>
  );
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
  const timeRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    timeRef.current += delta * speed;
    ref.current.position.x = Math.sin(timeRef.current) * travel;
  });

  return (
    <CameraBounds
      motion={{
        translation: {
          x: { min: -Math.abs(travel), max: Math.abs(travel) },
          y: { min: 0, max: 0 },
          z: { min: 0, max: 0 },
        },
      }}
      objectRef={ref}
    >
      {children}
    </CameraBounds>
  );
}
