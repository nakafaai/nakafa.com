import { useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { usePostprocessingDegraded } from "@repo/design-system/components/three/guard";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import type { DepthOfFieldEffect } from "postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useRef } from "react";
import type { Camera } from "three";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

/** Where the camera looks when no controls name a target, the lab's middle. */
const ORIGIN = new Vector3();

/** The camera's world position, measured again on every frame. */
const EYE = new Vector3();

/** Minimum focus distance change before rewriting the CoC uniform. */
const FOCUS_EPSILON = 1e-4;

/**
 * Restores direct WebGL rendering state if EffectComposer fails at runtime,
 * ensuring the scene continues rendering cleanly with PBR Neutral tone mapping.
 */
function DirectRendererFallback() {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    gl.autoClear = true;
    invalidate();
  }, [gl, invalidate]);

  return null;
}

/**
 * Keeps the lens focused on what the reader orbits: the target of the
 * scene's default controls. Camera near/far adoption runs only when camera
 * planes actually change instead of every frame.
 */
function Lens() {
  const { reach } = useStage();
  const lens = useRef<DepthOfFieldEffect>(null);
  const controls = useThree((state) => state.controls);
  const cached = useRef<{
    camera: Camera | null;
    distance: number;
    far: number;
    near: number;
  }>({
    camera: null,
    distance: Number.NaN,
    far: Number.NaN,
    near: Number.NaN,
  });

  useFrame(({ camera }) => {
    const effect = lens.current;
    if (effect === null) {
      return;
    }
    const near =
      camera instanceof PerspectiveCamera ||
      camera instanceof OrthographicCamera
        ? camera.near
        : Number.NaN;
    const far =
      camera instanceof PerspectiveCamera ||
      camera instanceof OrthographicCamera
        ? camera.far
        : Number.NaN;
    if (
      cached.current.camera !== camera ||
      cached.current.near !== near ||
      cached.current.far !== far
    ) {
      effect.cocMaterial.adoptCameraSettings(camera);
      cached.current.camera = camera;
      cached.current.near = near;
      cached.current.far = far;
    }
    const focus =
      controls !== null &&
      "target" in controls &&
      controls.target instanceof Vector3
        ? controls.target
        : ORIGIN;
    const distance = camera.getWorldPosition(EYE).distanceTo(focus);
    if (
      !Number.isFinite(cached.current.distance) ||
      Math.abs(distance - cached.current.distance) > FOCUS_EPSILON
    ) {
      effect.cocMaterial.focusDistance = distance;
      cached.current.distance = distance;
    }
  });

  return (
    <DepthOfField bokehScale={2.5} ref={lens} worldFocusRange={2.4 * reach} />
  );
}

/**
 * The photographic finish for capable desktop GPUs. Ambient occlusion darkens
 * creases and contacts, depth of field softens distant geometry, bloom lifts
 * emissive accents, and Khronos PBR Neutral tone mapping keeps authored colors
 * true.
 *
 * Mobile, low-end, software-rendered, and adaptively degraded canvases skip
 * multi-pass postprocessing completely and render directly with PBR Neutral
 * tone mapping on the main renderer, saving 50 to 90 MB of VRAM per canvas
 * and keeping frame times inside 60 to 120 fps. A non-fatal ErrorBoundary
 * guarantees any shader or half-float failure falls back to direct rendering.
 */
export function Finish() {
  const { profile, reach } = useStage();
  const degraded = usePostprocessingDegraded();

  if (!profile.postprocessing || degraded) {
    return null;
  }

  return (
    <ErrorBoundary
      fallbackRender={() => <DirectRendererFallback />}
      report={false}
    >
      <EffectComposer multisampling={4}>
        <N8AO
          aoRadius={0.2 * reach}
          distanceFalloff={1}
          intensity={2.5}
          quality="medium"
        />
        <Lens />
        <Bloom
          intensity={0.5}
          luminanceSmoothing={0.2}
          luminanceThreshold={2}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <HueSaturation saturation={0.08} />
        <BrightnessContrast contrast={0.06} />
        <Vignette darkness={0.42} offset={0.32} />
      </EffectComposer>
    </ErrorBoundary>
  );
}
