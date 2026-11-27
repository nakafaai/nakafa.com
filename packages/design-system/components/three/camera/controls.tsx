import { useTimeout } from "@mantine/hooks";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  cameraFitKey,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  resolveContentFit,
  resolvePanOffset,
} from "@repo/design-system/components/three/camera/fit";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import { useCameraPlay } from "@repo/design-system/components/three/camera/play";
import { resolveCameraRefit } from "@repo/design-system/components/three/camera/refit";
import { measureContent } from "@repo/design-system/components/three/camera/silhouette";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import {
  resolveAuthoredView,
  resolveCameraDistanceLimits,
  resolveOrthographicZoom,
} from "@repo/design-system/lib/geometry/camera";

import { Effect } from "effect";
import type { ComponentRef } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Box3, PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { OrthographicCamera as ThreeOrthographicCamera, Vector3 } from "three";

/** The pan correction of the drag in hand, written in place on every change. */
const PAN = new Vector3();

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
  cameraPosition?: readonly [number, number, number];
  cameraTarget?: readonly [number, number, number] | undefined;
  enablePan?: boolean;
  enableRotate?: boolean;
  enableZoom?: boolean;
  fov?: number;
  /** Fits every finite subject only when the illustration explicitly needs it. */
  framing?: "content" | undefined;
  maxAzimuthAngle?: number;
  /** Optional tighter dolly bound within the scene's initial framing limit. */
  maxDistance?: number | undefined;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  minDistance?: number | undefined;
  minPolarAngle?: number;
  /**
   * Whether pressing Play on the surrounding visual card gently orbits the
   * camera. Defaults to `false` so simulation labs keep the camera steady
   * while their physics or process runs; coordinate and static showcase scenes
   * opt in.
   */
  orbitOnPlay?: boolean | undefined;
  projection?: CameraProjection | undefined;
  /** Changing this key returns the camera to its authored pose in place without remounting. */
  resetKey?: number | string | undefined;
}

export function CameraControls(props: CameraControlsProps) {
  const {
    cameraPosition = DEFAULT_CAMERA_POSITION,
    cameraTarget = DEFAULT_CAMERA_TARGET,
    enablePan = true,
    enableRotate = true,
    enableZoom = true,
    framing: framingMode,
    fov = 50,
    maxAzimuthAngle,
    maxDistance,
    maxPolarAngle,
    minAzimuthAngle,
    minDistance,
    minPolarAngle,
    orbitOnPlay = false,
    projection = { kind: "perspective" },
    resetKey,
  } = props;
  const orthographicRef = useRef<ThreeOrthographicCamera>(null);
  const perspectiveRef = useRef<ThreePerspectiveCamera>(null);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastFit = useRef<{
    bounds: Box3;
    camera: ComponentRef<typeof OrbitControls>["object"];
    distance: number;
    key: string;
    target: Vector3;
    zoom: number;
  } | null>(null);
  const initialPose = useRef<{
    camera: ComponentRef<typeof OrbitControls>["object"];
    position: Vector3;
    target: Vector3;
    zoom: number;
  } | null>(null);
  const pointerActive = useRef(false);
  const settling = useRef(false);
  const pendingFit = useRef(false);
  const framing = useCameraFraming();
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const viewportWidth = useThree((state) => state.size.width);
  const viewportHeight = useThree((state) => state.size.height);
  const autoRotate = useCameraPlay(orbitOnPlay);
  const view = useVisualScene((state) => state.view, 0);
  const shownView = useRef(view);
  const shownResetKey = useRef(resetKey);

  useLayoutEffect(() => framing?.registerController(), [framing]);
  const [cameraPositionX, cameraPositionY, cameraPositionZ] = cameraPosition;
  const [cameraTargetX, cameraTargetY, cameraTargetZ] = cameraTarget;
  const projectionFov =
    projection.kind === "perspective" ? (projection.fov ?? fov) : fov;
  const projectionHeight =
    projection.kind === "orthographic" ? (projection.viewHeight ?? 0) : 0;
  // An authored pose keeps a square frame's sides on a portrait canvas, such
  // as a phone showing the scene full screen. A content fit covers both axes.
  const authoredView = resolveAuthoredView({
    fov: projectionFov,
    height: viewportHeight,
    width: viewportWidth,
  });
  const authoredExtent = authoredView.extent;
  const projectionNear = projection.near;
  const projectionFar = projection.far;

  useLayoutEffect(() => {
    if (!framing || viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const initializePose = (
      controls: ComponentRef<typeof OrbitControls>,
      position: Vector3,
      target: Vector3
    ) => {
      const object = controls.object;
      const initialized = initialPose.current;
      if (lastFit.current?.camera === object) {
        return;
      }
      const unchanged =
        initialized?.camera === object &&
        initialized.position.equals(position) &&
        initialized.target.equals(target);
      const distance = position.distanceTo(target);
      const limits = resolveCameraDistanceLimits({
        position: position.toArray(),
        target: target.toArray(),
        minDistance,
        maxDistance,
      });
      const zoom = resolveOrthographicZoom(
        projectionHeight ||
          2 * distance * Math.tan((projectionFov * Math.PI) / 360),
        authoredExtent
      );
      if (!unchanged) {
        object.position.copy(position);
        controls.target.copy(target);
      }
      if (object instanceof ThreeOrthographicCamera) {
        object.zoom =
          zoom.zoom * (unchanged ? object.zoom / initialized.zoom : 1);
        controls.minZoom = zoom.minZoom;
        controls.maxZoom = zoom.maxZoom;
      }
      controls.minDistance = limits.minDistance;
      controls.maxDistance = limits.maxDistance;
      object.near = projectionNear ?? 0.01;
      object.far = projectionFar ?? 1000;
      object.updateProjectionMatrix();
      initialPose.current = {
        camera: object,
        position,
        target,
        zoom: zoom.zoom,
      };
      controls.update();
      if (!unchanged) {
        controls.saveState();
      }
      framing.markFitted();
      invalidate();
    };

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
    const ownsCamera = () => {
      const owned =
        projection.kind === "orthographic"
          ? orthographicRef.current
          : perspectiveRef.current;
      return owned === null || camera === owned;
    };

    if (framingMode !== "content") {
      if (lastFit.current?.camera === camera) {
        lastFit.current = null;
        initialPose.current = null;
      }
      const applyPose = () => {
        const controls = controlsRef.current;
        if (controls?.object === camera && ownsCamera()) {
          initializePose(controls, authoredPosition, authoredTarget);
        }
      };
      applyPose();
      const unsubscribe = framing.subscribe(applyPose);
      framing.invalidate();
      return unsubscribe;
    }

    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    // Sampling and imperative Three.js updates run only at this React boundary.
    // The registry batches geometry, font, and viewport changes into one frame.
    const fit = () => {
      const controls = controlsRef.current;
      if (!controls || controls.object !== camera || !ownsCamera()) {
        return;
      }
      const object = controls.object;
      const previous =
        lastFit.current?.camera === object ? lastFit.current : null;
      if (previous && settling.current) {
        pendingFit.current = true;
        return;
      }
      const { labels, silhouettes } = Effect.runSync(
        measureContent({
          ...framing,
          position: authoredPosition,
          root: scene,
          target: authoredTarget,
        })
      );
      if (silhouettes.length === 0) {
        initializePose(controls, authoredPosition, authoredTarget);
        return;
      }
      const key = cameraFitKey({
        authoredPosition,
        authoredTarget,
        labels,
        maxDistance,
        minDistance,
        projectionFar,
        projectionFov,
        projectionHeight,
        projectionNear,
        silhouettes,
        viewportHeight,
        viewportWidth,
      });
      if (previous?.key === key) {
        framing.markFitted();
        return;
      }

      const fitted = resolveContentFit({
        fov: projectionFov,
        height: viewportHeight,
        labels,
        minimumViewHeight: projectionHeight,
        position: authoredPosition,
        projection: projection.kind,
        silhouettes,
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
      const refitted = resolveCameraRefit({
        authoredPosition,
        authoredTarget,
        currentPosition: object.position,
        currentTarget: controls.target,
        currentZoom: object.zoom,
        fitted,
        initialZoom,
        limits,
        near: projectionNear,
        far: projectionFar,
        previous,
      });
      controls.target.copy(refitted.target);
      object.position.copy(refitted.position);
      object.near = refitted.near;
      object.far = refitted.far;
      controls.minDistance = limits.minDistance;
      controls.maxDistance = limits.maxDistance;
      if (object instanceof ThreeOrthographicCamera) {
        object.zoom = refitted.zoom;
        controls.maxZoom = initialZoom.maxZoom;
        controls.minZoom = initialZoom.minZoom;
      }
      object.updateProjectionMatrix();
      lastFit.current = {
        bounds: fitted.bounds.expandByPoint(fitted.target),
        camera: object,
        distance: fitted.distance,
        key,
        target: fitted.target,
        zoom: initialZoom.zoom,
      };
      controls.update();
      framing.markFitted();
      invalidate();
    };

    const unsubscribe = framing.subscribe(fit);
    framing.invalidate();
    return unsubscribe;
  }, [
    authoredExtent,
    camera,
    cameraPositionX,
    cameraPositionY,
    cameraPositionZ,
    cameraTargetX,
    cameraTargetY,
    cameraTargetZ,
    framing,
    framingMode,
    invalidate,
    maxDistance,
    minDistance,
    projectionFar,
    projectionFov,
    projectionHeight,
    projection.kind,
    projectionNear,
    scene,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    const viewChanged = shownView.current !== view;
    const keyChanged = shownResetKey.current !== resetKey;
    if (!(viewChanged || keyChanged)) {
      return;
    }
    shownView.current = view;
    shownResetKey.current = resetKey;
    // The card's reset fits a fitted scene again and returns any other to its saved pose.
    if (framingMode === "content") {
      lastFit.current = null;
      framing?.invalidate();
    } else {
      controlsRef.current?.reset();
    }
    invalidate();
  }, [framing, framingMode, invalidate, resetKey, view]);

  const { start: startSettle, clear: clearSettle } = useTimeout(() => {
    settling.current = false;
    if (pendingFit.current) {
      pendingFit.current = false;
      framing?.invalidate();
    }
  }, 120);

  useEffect(() => {
    const previousCursor = domElement.style.cursor;

    domElement.style.cursor = "grab";

    return () => {
      domElement.style.cursor = previousCursor;
      clearSettle();
    };
  }, [clearSettle, domElement]);

  const releaseAfterDamping = useCallback(() => {
    clearSettle();
    startSettle();
  }, [clearSettle, startSettle]);

  const handleChange = useCallback(() => {
    const controls = controlsRef.current;
    const fitted = lastFit.current;
    if (controls && fitted?.camera === controls.object) {
      const offset = resolvePanOffset(fitted.bounds, controls.target, PAN);
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
    clearSettle();
    pointerActive.current = true;
    settling.current = true;
    domElement.style.cursor = "grabbing";
  }, [clearSettle, domElement]);

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
          {...(projection.far === undefined ? {} : { far: projection.far })}
          makeDefault
          {...(projection.near === undefined ? {} : { near: projection.near })}
          ref={orthographicRef}
        />
      ) : (
        <PerspectiveCamera
          {...(projection.far === undefined ? {} : { far: projection.far })}
          fov={framingMode === "content" ? projectionFov : authoredView.fov}
          makeDefault
          {...(projection.near === undefined ? {} : { near: projection.near })}
          ref={perspectiveRef}
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
        {...(maxAzimuthAngle === undefined ? {} : { maxAzimuthAngle })}
        {...(maxPolarAngle === undefined ? {} : { maxPolarAngle })}
        {...(minAzimuthAngle === undefined ? {} : { minAzimuthAngle })}
        {...(minPolarAngle === undefined ? {} : { minPolarAngle })}
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
