"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, useCallback, useEffect, useRef } from "react";

const DEFAULT_CAMERA_X = 12;
const DEFAULT_CAMERA_Y = 8;
const DEFAULT_CAMERA_Z = 12;
const DEFAULT_TARGET_X = 0;
const DEFAULT_TARGET_Y = 0;
const DEFAULT_TARGET_Z = 0;
const DEFAULT_CAMERA_POSITION = [
  DEFAULT_CAMERA_X,
  DEFAULT_CAMERA_Y,
  DEFAULT_CAMERA_Z,
] satisfies readonly [number, number, number];
const DEFAULT_CAMERA_TARGET = [
  DEFAULT_TARGET_X,
  DEFAULT_TARGET_Y,
  DEFAULT_TARGET_Z,
] satisfies readonly [number, number, number];

/**
 * Keeps a shared R3F camera and OrbitControls pair in sync with scene-specific
 * camera defaults.
 *
 * When the caller changes the camera target, the controls reset immediately so
 * each interactive scene starts from a readable view without forcing the user to
 * drag or zoom first.
 *
 * This effect is intentional: React effects are for synchronizing with external
 * systems, Three.js requires OrbitControls.update() after manual camera
 * transform changes, and demand-rendered R3F canvases need invalidate() after
 * imperative mutations.
 *
 * @see https://react.dev/learn/synchronizing-with-effects
 * @see https://threejs.org/docs/#examples/en/controls/OrbitControls
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance
 * @see https://drei.docs.pmnd.rs/controls/orbit-controls
 */
export function CameraControls({
  cameraPosition = DEFAULT_CAMERA_POSITION,
  cameraTarget = DEFAULT_CAMERA_TARGET,
  autoRotate = true,
}: {
  cameraPosition?: readonly [number, number, number];
  cameraTarget?: readonly [number, number, number];
  autoRotate?: boolean;
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const regress = useThree((state) => state.performance.regress);

  useEffect(() => {
    if (!controlsRef.current) {
      return;
    }

    controlsRef.current.object.position.set(...cameraPosition);
    controlsRef.current.target.set(...cameraTarget);
    controlsRef.current.update();
    invalidate();
  }, [cameraPosition, cameraTarget, invalidate]);

  useEffect(() => {
    const previousCursor = domElement.style.cursor;

    domElement.style.cursor = "grab";

    return () => {
      domElement.style.cursor = previousCursor;
    };
  }, [domElement]);

  useFrame(() => {
    if (!autoRotate) {
      return;
    }

    if (!controlsRef.current) {
      return;
    }

    regress();
    controlsRef.current.update();
    invalidate();
  });

  /**
   * Re-renders demand-driven canvases when the user interacts with controls.
   */
  const handleChange = useCallback(() => {
    regress();
    invalidate();
  }, [invalidate, regress]);

  /**
   * Mirrors OrbitControls interaction state into the canvas cursor.
   */
  const handleStart = useCallback(() => {
    domElement.style.cursor = "grabbing";
  }, [domElement]);

  /**
   * Restores the visible affordance after OrbitControls releases capture.
   */
  const handleEnd = useCallback(() => {
    domElement.style.cursor = "grab";
  }, [domElement]);

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
        onEnd={handleEnd}
        onStart={handleStart}
        ref={controlsRef}
        screenSpacePanning={true}
        target={cameraTarget}
        zoomSpeed={1.25}
      />
    </>
  );
}
