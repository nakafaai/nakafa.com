"use client";

import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import {
  type CameraProjection,
  resolveCameraDistanceLimits,
  resolveOrthographicZoom,
} from "@repo/design-system/lib/geometry/camera";
import { measureCameraBounds } from "@repo/design-system/lib/geometry/camera/bounds";
import {
  resolveCameraFit,
  resolveCameraPanOffset,
} from "@repo/design-system/lib/geometry/camera/fit";
import { Effect, Option } from "effect";
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import {
  type Box3,
  OrthographicCamera as ThreeOrthographicCamera,
  Vector3,
} from "three";

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
 * Owns the scene camera, finite-content framing, and OrbitControls together.
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
  /** Optional tighter dolly bound within the scene's initial framing limit. */
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
    maxDistance,
    maxPolarAngle,
    minAzimuthAngle,
    minDistance,
    minPolarAngle,
    projection = { kind: "perspective" },
  } = props;
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastFit = useRef<{
    bounds: Box3;
    camera: ComponentRef<typeof OrbitControls>["object"];
    distance: number;
    key: string;
    target: Vector3;
    zoom: number;
  } | null>(null);
  const pointerActive = useRef(false);
  const settling = useRef(false);
  const pendingFit = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const framing = useCameraFraming();
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const viewportWidth = useThree((state) => state.size.width);
  const viewportHeight = useThree((state) => state.size.height);
  const [cameraPositionX, cameraPositionY, cameraPositionZ] = cameraPosition;
  const [cameraTargetX, cameraTargetY, cameraTargetZ] = cameraTarget;
  const projectionFov =
    projection.kind === "perspective" ? (projection.fov ?? fov) : fov;
  const projectionHeight =
    projection.kind === "orthographic" ? projection.viewHeight : 0;
  const projectionNear = projection.near;
  const projectionFar = projection.far;

  useLayoutEffect(() => {
    if (!framing || viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    // Sampling and imperative Three.js updates run only at this React boundary.
    // The registry batches geometry, font, and viewport changes into one frame.
    const fit = () => {
      const controls = controlsRef.current;
      if (!controls || controls.object !== camera) {
        return;
      }
      const object = controls.object;
      const previous =
        lastFit.current?.camera === object ? lastFit.current : null;
      if (previous && settling.current) {
        pendingFit.current = true;
        return;
      }
      const authoredPosition = new Vector3(
        cameraPositionX,
        cameraPositionY,
        cameraPositionZ
      );
      const authoredTarget = new Vector3(
        cameraTargetX,
        cameraTargetY,
        cameraTargetZ
      );
      const bounds = Effect.runSync(
        measureCameraBounds({
          labels: framing.labels,
          position: authoredPosition,
          root: scene,
          subjects: framing.subjects,
          target: authoredTarget,
        })
      );
      if (Option.isNone(bounds)) {
        return;
      }
      const key = [
        ...bounds.value.min.toArray(),
        ...bounds.value.max.toArray(),
        ...authoredPosition.toArray(),
        ...authoredTarget.toArray(),
        viewportWidth,
        viewportHeight,
        projectionFov,
        projectionHeight,
        projectionNear,
        projectionFar,
        minDistance,
        maxDistance,
      ].join(",");
      if (previous?.key === key) {
        return;
      }

      const fitted = resolveCameraFit({
        bounds: bounds.value,
        fov: projectionFov,
        height: viewportHeight,
        position: authoredPosition,
        target: authoredTarget,
        width: viewportWidth,
      });
      const limits = resolveCameraDistanceLimits({
        maxDistance,
        minDistance,
        position: fitted.position.toArray(),
        target: fitted.target.toArray(),
      });
      const initialZoom = resolveOrthographicZoom(
        Math.max(fitted.viewHeight, projectionHeight),
        viewportHeight
      );
      const position = previous ? object.position.clone() : authoredPosition;
      const target = previous ? controls.target.clone() : authoredTarget;
      const distanceRatio = previous
        ? position.distanceTo(target) / previous.distance
        : 1;
      const distance = Math.min(
        limits.maxDistance,
        Math.max(limits.minDistance, fitted.distance * distanceRatio)
      );
      const direction = position.sub(target).normalize();
      const pan = previous
        ? target
            .sub(previous.target)
            .multiplyScalar(fitted.distance / previous.distance)
        : new Vector3();
      controls.target.copy(fitted.target).add(pan);
      object.position
        .copy(controls.target)
        .addScaledVector(direction, distance);
      object.near = projectionNear ?? fitted.near;
      object.far = Math.max(projectionFar ?? 0, fitted.far);
      controls.minDistance = limits.minDistance;
      controls.maxDistance = limits.maxDistance;
      if (object instanceof ThreeOrthographicCamera) {
        const zoomRatio = previous ? object.zoom / previous.zoom : 1;
        object.zoom = Math.min(
          initialZoom.maxZoom,
          Math.max(initialZoom.minZoom, initialZoom.zoom * zoomRatio)
        );
        controls.maxZoom = initialZoom.maxZoom;
        controls.minZoom = initialZoom.minZoom;
      }
      object.updateProjectionMatrix();
      lastFit.current = {
        bounds: bounds.value,
        camera: object,
        distance: fitted.distance,
        key,
        target: fitted.target,
        zoom: initialZoom.zoom,
      };
      controls.update();
      invalidate();
    };

    const unsubscribe = framing.subscribe(fit);
    framing.invalidate();
    return unsubscribe;
  }, [
    camera,
    cameraPositionX,
    cameraPositionY,
    cameraPositionZ,
    cameraTargetX,
    cameraTargetY,
    cameraTargetZ,
    framing,
    invalidate,
    maxDistance,
    minDistance,
    projectionFar,
    projectionFov,
    projectionHeight,
    projectionNear,
    scene,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    const previousCursor = domElement.style.cursor;

    domElement.style.cursor = "grab";

    return () => {
      domElement.style.cursor = previousCursor;
      clearTimeout(settleTimer.current);
    };
  }, [domElement]);

  const releaseAfterDamping = useCallback(() => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settling.current = false;
      if (pendingFit.current) {
        pendingFit.current = false;
        framing?.invalidate();
      }
    }, 120);
  }, [framing]);

  const handleChange = useCallback(() => {
    const controls = controlsRef.current;
    const fitted = lastFit.current;
    if (controls && fitted?.camera === controls.object) {
      const offset = resolveCameraPanOffset(fitted.bounds, controls.target);
      controls.target.add(offset);
      controls.object.position.add(offset);
    }
    if (settling.current && !pointerActive.current) {
      releaseAfterDamping();
    }
  }, [releaseAfterDamping]);

  /**
   * Mirrors OrbitControls interaction state into the canvas cursor.
   */
  const handleStart = useCallback(() => {
    clearTimeout(settleTimer.current);
    pointerActive.current = true;
    settling.current = true;
    domElement.style.cursor = "grabbing";
  }, [domElement]);

  /**
   * Restores the visible affordance after OrbitControls releases capture.
   */
  const handleEnd = useCallback(() => {
    pointerActive.current = false;
    releaseAfterDamping();
    domElement.style.cursor = "grab";
  }, [domElement, releaseAfterDamping]);

  return (
    <>
      {projection.kind === "orthographic" ? (
        <OrthographicCamera
          far={projection.far}
          makeDefault
          near={projection.near}
        />
      ) : (
        <PerspectiveCamera
          far={projection.far}
          fov={projection.fov ?? fov}
          makeDefault
          near={projection.near}
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
        maxPolarAngle={maxPolarAngle}
        minAzimuthAngle={minAzimuthAngle}
        minPolarAngle={minPolarAngle}
        onChange={handleChange}
        onEnd={handleEnd}
        onStart={handleStart}
        ref={controlsRef}
        screenSpacePanning={true}
        zoomSpeed={1.25}
      />
    </>
  );
}
