"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export function CameraControls({
  cameraPosition = [12, 8, 12],
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

  // Handle control changes for on-demand rendering and performance regression
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const handleChange = () => {
      // Trigger performance regression on control changes (movement)
      performance.regress();
      invalidate();
    };

    // Listen for control changes
    controls.addEventListener("change", handleChange);

    return () => {
      controls.removeEventListener("change", handleChange);
    };
  }, [invalidate, performance]);

  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPosition} fov={50} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={1}
        maxDistance={100}
        zoomSpeed={1.25}
        enableZoom={true}
        screenSpacePanning={true}
      />
    </>
  );
}
