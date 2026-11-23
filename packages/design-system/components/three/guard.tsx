import { useFrame, useStore, useThree } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { createPerformanceMonitor } from "@repo/design-system/components/three/monitor";
import {
  useVisualReset,
  useVisualScene,
} from "@repo/design-system/components/visual/card";
import { isSoftwareRenderer } from "@repo/design-system/lib/device";
import type { ReactNode } from "react";
import {
  createContext,
  use,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { WebGLRenderer } from "three";

/** Whether the adaptive frame-time monitor disabled postprocessing for this canvas. */
const PostprocessingDegradedContext = createContext(false);

/** Provides adaptive postprocessing degradation state to stage finish components. */
export function CanvasQualityProvider({
  children,
  degraded,
}: {
  readonly children: ReactNode;
  readonly degraded: boolean;
}) {
  return (
    <PostprocessingDegradedContext value={degraded}>
      {children}
    </PostprocessingDegradedContext>
  );
}

/** Reads whether the surrounding canvas stepped down postprocessing to protect 60 fps. */
export function usePostprocessingDegraded(): boolean {
  return use(PostprocessingDegradedContext);
}

/**
 * Keeps scene time continuous while a canvas pauses.
 *
 * Fiber restarts `clock.elapsedTime` at zero whenever the frameloop changes,
 * and scenes animate from that time, so a resumed canvas restores the last
 * rendered time. Pausing drops pending invalidated frames so manual-advance
 * deltas never jump animations forward.
 */
export function SceneTime({ controlled }: { readonly controlled: boolean }) {
  const store = useStore();
  const playing = useVisualScene((state) => state.playing, false);
  const active = controlled ? playing : true;
  const elapsed = useRef(0);

  useVisualReset(() => {
    elapsed.current = 0;
    const state = store.getState();
    state.clock.elapsedTime = 0;
    state.invalidate();
  });

  // Negative priority runs before every scene's default-priority useFrame
  // without taking over R3F rendering, keeping clock.elapsedTime frozen while
  // paused while still passing live delta to OrbitControls damping.
  useFrame(({ clock }, delta) => {
    if (active) {
      elapsed.current += simulationStep(delta);
    }
    clock.elapsedTime = elapsed.current;
  }, -10);

  useLayoutEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.frameloop === previous.frameloop) {
          return;
        }
        if (state.frameloop === "never") {
          state.internal.frames = 0;
          return;
        }
        state.clock.elapsedTime = elapsed.current;
        state.invalidate();
      }),
    [store]
  );

  return null;
}

/** Reads the renderer name string from a WebGLRenderer for software rasterizer checks. */
function readRendererName(gl: WebGLRenderer): string {
  const context = gl.getContext();
  const info = context.getExtension("WEBGL_debug_renderer_info");
  return String(
    context.getParameter(
      info === null ? context.RENDERER : info.UNMASKED_RENDERER_WEBGL
    )
  );
}

/**
 * Monitors active animation frame durations using a rolling EMA and triggers
 * graceful step-downs (disabling postprocessing first, then capping DPR to 1)
 * when sustained frames drop below 60 fps on real GPUs.
 */
export function PerformanceGuard({
  active,
  onDropPostprocessing,
  onReduceDpr,
}: {
  readonly active: boolean;
  readonly onDropPostprocessing: () => void;
  readonly onReduceDpr: () => void;
}) {
  const gl = useThree((state) => state.gl);
  const viewportDpr = useThree((state) => state.viewport.dpr);
  const dropPostprocessing = useEffectEvent(onDropPostprocessing);
  const reduceDpr = useEffectEvent(onReduceDpr);
  const monitor = useMemo(() => {
    const software = isSoftwareRenderer(readRendererName(gl));
    return createPerformanceMonitor({
      canReduceDpr: !software && viewportDpr > 1,
      hasPostprocessing: !software,
    });
  }, [gl, viewportDpr]);
  const lastLevel = useRef(monitor.current());

  useFrame((_, delta) => {
    if (!active) {
      return;
    }
    const next = monitor.record(delta * 1000);
    if (next === lastLevel.current) {
      return;
    }
    lastLevel.current = next;
    if (next === "direct") {
      dropPostprocessing();
      return;
    }
    if (next === "reduced") {
      dropPostprocessing();
      reduceDpr();
    }
  }, -9);

  return null;
}
