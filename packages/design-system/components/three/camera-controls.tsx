"use client";

import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
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
 * Camera tuples are read by value so MDX and visualization callers can pass
 * inline arrays without resetting the user's orbit on unrelated re-renders.
 *
 * This effect is intentional: React effects are for synchronizing with external
 * systems, Three.js requires OrbitControls.update() after manual camera
 * transform changes, and demand-rendered R3F canvases need invalidate() after
 * imperative mutations.
 *
 * Drei owns OrbitControls frame updates and demand-mode invalidation. Keeping a
 * second update or performance-regression loop here would resize AdaptiveDpr's
 * drawing buffer while camera damping settles.
 *
 * @see https://react.dev/learn/synchronizing-with-effects
 * @see https://threejs.org/docs/#examples/en/controls/OrbitControls
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance
 * @see https://drei.docs.pmnd.rs/controls/orbit-controls
 */
interface CameraControlsProps {
  autoRotate?: boolean;
  cameraPosition?: readonly [number, number, number];
  cameraTarget?: readonly [number, number, number];
  enablePan?: boolean;
  enableRotate?: boolean;
  enableZoom?: boolean;
  fov?: number;
  maxAzimuthAngle?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  minDistance?: number;
  minPolarAngle?: number;
  projection?: CameraProjection;
}

export function CameraControls(props: CameraControlsProps) {
  const {
    cameraPosition = DEFAULT_CAMERA_POSITION,
    cameraTarget = DEFAULT_CAMERA_TARGET,
    autoRotate = true,
    enablePan = true,
    enableRotate = true,
    enableZoom = true,
    fov = 50,
    maxAzimuthAngle,
    maxDistance = 100,
    maxPolarAngle,
    minAzimuthAngle,
    minDistance = 1,
    minPolarAngle,
    projection = { kind: "perspective" },
  } = props;
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const viewportHeight = useThree((state) => state.size.height);
  const [cameraPositionX, cameraPositionY, cameraPositionZ] = cameraPosition;
  const [cameraTargetX, cameraTargetY, cameraTargetZ] = cameraTarget;

  useEffect(() => {
    if (!controlsRef.current) {
      return;
    }

    controlsRef.current.object.position.set(
      cameraPositionX,
      cameraPositionY,
      cameraPositionZ
    );
    controlsRef.current.target.set(cameraTargetX, cameraTargetY, cameraTargetZ);
    controlsRef.current.update();
    invalidate();
  }, [
    cameraPositionX,
    cameraPositionY,
    cameraPositionZ,
    cameraTargetX,
    cameraTargetY,
    cameraTargetZ,
    invalidate,
  ]);

  useEffect(() => {
    const previousCursor = domElement.style.cursor;

    domElement.style.cursor = "grab";

    return () => {
      domElement.style.cursor = previousCursor;
    };
  }, [domElement]);

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
      {projection.kind === "orthographic" ? (
        <OrthographicCamera
          far={projection.far}
          makeDefault
          near={projection.near}
          position={cameraPosition}
          zoom={viewportHeight / projection.viewHeight}
        />
      ) : (
        <PerspectiveCamera
          far={projection.far}
          fov={projection.fov ?? fov}
          makeDefault
          near={projection.near}
          position={cameraPosition}
        />
      )}
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        dampingFactor={0.05}
        enableDamping
        enablePan={enablePan}
        enableRotate={enableRotate}
        enableZoom={enableZoom}
        makeDefault
        maxAzimuthAngle={maxAzimuthAngle}
        maxDistance={maxDistance}
        maxPolarAngle={maxPolarAngle}
        minAzimuthAngle={minAzimuthAngle}
        minDistance={minDistance}
        minPolarAngle={minPolarAngle}
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
