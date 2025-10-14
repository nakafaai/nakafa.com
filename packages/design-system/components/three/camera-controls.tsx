"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const DEFAULT_CAMERA_X = 12;
const DEFAULT_CAMERA_Y = 8;
const DEFAULT_CAMERA_Z = 12;

export function CameraControls({
  cameraPosition = [DEFAULT_CAMERA_X, DEFAULT_CAMERA_Y, DEFAULT_CAMERA_Z],
  autoRotate = true,
}: {
  cameraPosition?: [number, number, number];
  autoRotate?: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { invalidate, performance } = useThree();

  // Handle auto-rotation with proper invalidation for on-demand rendering
  useFrame(() => {
    if (autoRotate && controlsRef.current) {
      // Trigger performance regression during auto-rotation
      performance.regress();
      // Only invalidate if auto-rotate is actually changing something
      controlsRef.current.update();
      invalidate();
    }
  });

  function handleChange() {
    // Trigger performance regression on control changes (movement)
    performance.regress();
    invalidate();
  }

  return (
    <>
      <PerspectiveCamera fov={50} makeDefault position={cameraPosition} />
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        dampingFactor={0.05}
        enableDamping
        enableZoom={true}
        makeDefault
        maxDistance={100}
        minDistance={1}
        onChange={handleChange}
        ref={controlsRef}
        screenSpacePanning={true}
        zoomSpeed={1.25}
      />
    </>
  );
}
