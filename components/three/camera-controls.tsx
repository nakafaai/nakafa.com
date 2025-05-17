"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

export function CameraControls({
  cameraPosition = [12, 8, 12],
  autoRotate = true,
}: {
  cameraPosition?: [number, number, number];
  autoRotate?: boolean;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPosition} fov={50} />
      <OrbitControls
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
