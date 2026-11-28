import { useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  N8AO,
  ToneMapping,
} from "@react-three/postprocessing";
import { usePostprocessingDegraded } from "@repo/design-system/components/three/guard";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { ToneMappingMode } from "postprocessing";
import { useEffect } from "react";

/**
 * Restores direct WebGL rendering state if EffectComposer fails at runtime,
 * ensuring the scene continues rendering cleanly with the canvas's own film curve.
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
 * The photographic finish for capable desktop GPUs. Ambient occlusion darkens
 * creases and contacts, bloom lifts only what is brighter than a lit white
 * surface (a lamp, a glowing tube, the sun's disc), and the ACES film curve
 * gives every lab the contrast and highlight roll-off of a photograph. No
 * colour grade, blur or vignette follows it, so this path and the direct
 * one show the same picture.
 *
 * Mobile, low-end, software-rendered, and adaptively degraded canvases skip
 * multi-pass postprocessing completely and render directly with the same
 * film curve on the main renderer, saving 50 to 90 MB of VRAM per canvas
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
          aoRadius={0.18 * reach}
          distanceFalloff={1}
          intensity={2.2}
          quality="medium"
        />
        <Bloom
          intensity={0.42}
          luminanceSmoothing={0.2}
          luminanceThreshold={2}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </ErrorBoundary>
  );
}
