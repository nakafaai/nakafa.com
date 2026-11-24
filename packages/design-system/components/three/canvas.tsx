import {
  useIntersection,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import type { CanvasProps } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { CameraFraming } from "@repo/design-system/components/three/camera/framing";
import { THREE_RENDER_MARGIN } from "@repo/design-system/components/three/data/constants";
import {
  SCENE_STARTS,
  SceneFailure,
} from "@repo/design-system/components/three/failure";
import {
  CanvasQualityProvider,
  PerformanceGuard,
  SceneTime,
} from "@repo/design-system/components/three/guard";
import {
  disposeWebGLRenderer,
  readDocumentHidden,
  readServerDocumentHidden,
  resolveFrameloop,
  resolveVisibleStage,
  subscribeToDocumentVisibility,
  subscribeToInert,
  watchContextLoss,
} from "@repo/design-system/components/three/host";
import {
  SceneOverlay,
  SceneOverlayProvider,
} from "@repo/design-system/components/three/overlay";
import {
  SceneSpinner,
  useNotifySceneDrawn,
  useNotifySceneFailed,
  useNotifySceneLoading,
} from "@repo/design-system/components/three/placeholder";
import { getSharedContextPool } from "@repo/design-system/components/three/pool";
import { waitRetryDelay } from "@repo/design-system/components/three/retry";
import { SceneDrawn } from "@repo/design-system/components/three/reveal";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import {
  useHasVisualCard,
  useStartVisualScene,
  useVisualScene,
} from "@repo/design-system/components/visual/card";
import {
  getCanvasDpr,
  getPowerPreference,
  isWebGLAvailable,
  shouldEnableAntialias,
} from "@repo/design-system/lib/device";
import { ClientOnly } from "@tanstack/react-router";
import { cn } from "cn";
import { Effect, Fiber } from "effect";
import type { ComponentProps, ReactNode } from "react";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ToneMapping, WebGLRenderer } from "three";
import { useStore as useZustandStore } from "zustand";

/**
 * Shared Three.js canvas: one scene in a frame that keeps its size from the
 * first paint to the scene's first frame, with its loading state in the middle.
 *
 * A shared LRU WebGL context pool bounds live GPU contexts to 2 on mobile and
 * low-end hardware and 4 on desktop. Off-screen canvases release their context
 * cleanly with `forceContextLoss()` when another scene needs a slot (or on
 * mobile while scrolling past), then automatically re-acquire and redraw when
 * scrolled back into view with zero layout shift.
 *
 * Active animated scenes run at the display's native refresh rate (60Hz, 90Hz,
 * 120Hz+) via `frameloop="always"`, while paused, static, and reduced-motion
 * scenes render on `"demand"`, and off-screen, hidden-tab, or inert-background
 * scenes stop completely with `frameloop="never"`.
 */
function ThreeCanvasComponent({
  children,
  className,
  frameloop = "demand",
  onCreated,
  toneMapping,
  ...props
}: {
  children: ReactNode;
  frameloop?: "always" | "demand";
  toneMapping?: ToneMapping;
} & Omit<CanvasProps, "camera" | "fallback" | "gl" | "orthographic">) {
  const canvasId = useId();
  const pool = getSharedContextPool();
  const powerPreference = getPowerPreference();
  const baseDpr = getCanvasDpr();
  const antialias = shouldEnableAntialias();
  const notifyDrawn = useNotifySceneDrawn();
  const notifyLoading = useNotifySceneLoading();
  const notifyFailed = useNotifySceneFailed();
  const hasCard = useHasVisualCard();
  const playing = useVisualScene((state) => state.playing, false);
  const start = useStartVisualScene();
  const startedAlways = useRef(false);
  const startAlways = useEffectEvent(() => start());
  const { entry, ref } = useIntersection<HTMLDivElement>({
    rootMargin: `${THREE_RENDER_MARGIN}px`,
  });
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const frameRef = useMergedRef(ref, setFrame);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const [mountKey, setMountKey] = useState(1);
  const [attempt, setAttempt] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const [stage, setStage] = useState<"drawn" | "failed" | "loading">("loading");
  const [postprocessingDegraded, setPostprocessingDegraded] = useState(false);
  const [dprReduced, setDprReduced] = useState(false);

  const rendererRef = useRef<WebGLRenderer | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const cleanupLossRef = useRef<(() => void) | null>(null);
  const intentionalLossRef = useRef(false);
  const retryFiberRef = useRef<Fiber.Fiber<void, never> | null>(null);
  const mountedRef = useRef(true);

  const hasSlot = useZustandStore(
    pool.store,
    (state) => state.entries[canvasId]?.active ?? false
  );

  const behindInert = useSyncExternalStore(
    subscribeToInert,
    () => Boolean(frame?.closest("[inert]")),
    () => false
  );
  const documentHidden = useSyncExternalStore(
    subscribeToDocumentVisibility,
    readDocumentHidden,
    readServerDocumentHidden
  );

  const observedNear = entry?.isIntersecting ?? false;
  const nearViewport = entry?.isIntersecting ?? true;
  const running = nearViewport && !behindInert && !documentHidden;
  const paced = hasCard ? playing : !calm && frameloop === "always";
  const drawn = stage === "drawn" && hasSlot && !retrying;
  const visibleStage = resolveVisibleStage(stage, drawn);
  const dpr: [number, number] = dprReduced ? [1, 1] : baseDpr;
  const activeFrameloop = resolveFrameloop(running, paced);

  const cancelRetry = useEffectEvent(() => {
    const fiber = retryFiberRef.current;
    if (fiber !== null) {
      retryFiberRef.current = null;
      Effect.runFork(Fiber.interrupt(fiber));
    }
  });

  const disposeRenderer = useEffectEvent(() => {
    cleanupLossRef.current?.();
    cleanupLossRef.current = null;
    invalidateRef.current = null;
    const gl = rendererRef.current;
    if (gl === null) {
      return;
    }
    rendererRef.current = null;
    intentionalLossRef.current = true;
    disposeWebGLRenderer(gl);
  });

  const handleEvicted = useEffectEvent(() => {
    cancelRetry();
    disposeRenderer();
    if (mountedRef.current) {
      // Incrementing mountKey guarantees a fresh Canvas and SceneDrawn even if
      // the pool re-promotes this entry within the same React commit batch.
      setMountKey((key) => key + 1);
      setStage("loading");
      notifyLoading?.();
    }
  });

  const markFailed = useEffectEvent(() => {
    setRetrying(false);
    setStage("failed");
    notifyFailed?.();
  });

  const scheduleRecovery = useEffectEvent(
    (failedAttempt: number, immediateCheckWebGL: boolean) => {
      cancelRetry();
      disposeRenderer();
      pool.releaseOffscreen(canvasId);

      if (
        immediateCheckWebGL &&
        pool.activeCount() <= 1 &&
        !isWebGLAvailable()
      ) {
        pool.release(canvasId);
        markFailed();
        return;
      }

      setRetrying(true);
      setStage("loading");
      notifyLoading?.();

      const fiber = Effect.runFork(
        waitRetryDelay(failedAttempt).pipe(
          Effect.andThen((shouldRetry) =>
            Effect.sync(() => {
              retryFiberRef.current = null;
              if (!mountedRef.current) {
                return;
              }
              if (!shouldRetry) {
                markFailed();
                return;
              }
              setRetrying(false);
              setAttempt((count) => count + 1);
              setMountKey((key) => key + 1);
            })
          )
        )
      );
      retryFiberRef.current = fiber;
    }
  );

  // Sync viewport visibility with the shared LRU WebGL context pool.
  useEffect(() => {
    if (stage === "failed" || retrying) {
      return;
    }
    if (observedNear && !behindInert && !documentHidden) {
      pool.acquire(canvasId, handleEvicted);
      return;
    }
    if (entry !== null && !entry.isIntersecting) {
      pool.markOffscreen(canvasId);
    }
  }, [
    behindInert,
    canvasId,
    documentHidden,
    entry,
    observedNear,
    pool,
    retrying,
    stage,
  ]);

  // Clean up GPU resources, listeners, fibers, and pool slot on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRetry();
      disposeRenderer();
      pool.release(canvasId);
    };
  }, [canvasId, pool]);

  // Continuous-motion labs (`frameloop="always"`) start playing once on their
  // first drawn frame unless reduced motion is set, just like P5Sketch, so the
  // card's Pause button accurately reflects state and halts animation.
  useEffect(() => {
    if (
      frameloop === "always" &&
      hasCard &&
      drawn &&
      !calm &&
      !startedAlways.current
    ) {
      startedAlways.current = true;
      startAlways();
    }
  }, [calm, drawn, frameloop, hasCard]);

  /** Manually restarts the scene on a fresh canvas after a failure. */
  const manualRestart = () => {
    cancelRetry();
    disposeRenderer();
    pool.releaseOffscreen(canvasId);
    setRetrying(false);
    setStage("loading");
    setAttempt(1);
    setMountKey((key) => key + 1);
    notifyLoading?.();
    if (observedNear && !behindInert && !documentHidden) {
      pool.acquire(canvasId, handleEvicted);
    }
  };

  const handleContextLost = useEffectEvent(() => {
    pool.releaseOffscreen(canvasId);
    if (!observedNear) {
      disposeRenderer();
      pool.release(canvasId);
      setMountKey((key) => key + 1);
      setStage("loading");
      notifyLoading?.();
      return;
    }
    // Give the browser a backoff window to fire webglcontextrestored before remounting.
    cancelRetry();
    setStage("loading");
    notifyLoading?.();
    const fiber = Effect.runFork(
      waitRetryDelay(attempt).pipe(
        Effect.andThen((shouldRetry) =>
          Effect.sync(() => {
            retryFiberRef.current = null;
            if (!mountedRef.current) {
              return;
            }
            disposeRenderer();
            if (!shouldRetry) {
              pool.release(canvasId);
              markFailed();
              return;
            }
            setAttempt((count) => count + 1);
            setMountKey((key) => key + 1);
          })
        )
      )
    );
    retryFiberRef.current = fiber;
  });

  const handleContextRestored = useEffectEvent(() => {
    cancelRetry();
    setRetrying(false);
    setStage("drawn");
    notifyDrawn?.();
    invalidateRef.current?.();
  });

  const handleBoundaryError = () => {
    if (attempt >= SCENE_STARTS) {
      disposeRenderer();
      pool.releaseOffscreen(canvasId);
      pool.release(canvasId);
      markFailed();
      return;
    }
    scheduleRecovery(attempt, true);
  };

  const shouldMountCanvas = hasSlot && !retrying && stage !== "failed";

  return (
    // The loading state, the canvas and the overlay fill this frame.
    <div
      aria-busy={visibleStage === "loading"}
      className="relative size-full min-w-0 overflow-hidden rounded-[inherit]"
      data-scene-state={visibleStage}
      ref={frameRef}
    >
      {shouldMountCanvas ? (
        <div
          className={cn("size-full", !drawn && "pointer-events-none opacity-0")}
        >
          <CanvasQualityProvider degraded={postprocessingDegraded}>
            <SceneOverlayProvider>
              <ErrorBoundary
                fallbackRender={() => null}
                key={mountKey}
                onError={handleBoundaryError}
              >
                <Canvas
                  className={cn(
                    "size-full overflow-hidden rounded-[inherit] [&_canvas]:size-full [&_canvas]:rounded-[inherit] [&>div]:rounded-[inherit]",
                    className
                  )}
                  dpr={dpr}
                  frameloop={activeFrameloop}
                  gl={{
                    alpha: true,
                    antialias,
                    failIfMajorPerformanceCaveat: false,
                    powerPreference,
                    toneMapping,
                  }}
                  onCreated={(state) => {
                    intentionalLossRef.current = false;
                    rendererRef.current = state.gl;
                    invalidateRef.current = state.invalidate;
                    cleanupLossRef.current?.();
                    cleanupLossRef.current = watchContextLoss(state.gl, {
                      isIntentional: () => intentionalLossRef.current,
                      onLost: handleContextLost,
                      onRestored: handleContextRestored,
                    });
                    onCreated?.(state);
                  }}
                  shadows="percentage"
                  {...props}
                >
                  <SceneTime controlled={hasCard} />
                  <PerformanceGuard
                    active={activeFrameloop === "always"}
                    onDropPostprocessing={() => setPostprocessingDegraded(true)}
                    onReduceDpr={() => setDprReduced(true)}
                  />
                  <CameraFraming>
                    <Suspense fallback={null}>
                      {children}
                      <SceneDrawn
                        onDrawn={() => {
                          setStage("drawn");
                          notifyDrawn?.();
                        }}
                      />
                    </Suspense>
                  </CameraFraming>
                </Canvas>
              </ErrorBoundary>
              <SceneOverlay />
            </SceneOverlayProvider>
          </CanvasQualityProvider>
        </div>
      ) : null}
      {visibleStage === "loading" ? <SceneSpinner /> : null}
      {visibleStage === "failed" && notifyFailed === null ? (
        <SceneFailure onRestart={manualRestart} />
      ) : null}
    </div>
  );
}

/**
 * Mounts the canvas on the client only. The canvas lives in this module, so it
 * needs no lazy boundary of its own; the loading state holds the place until
 * mount.
 */
export function ThreeCanvas(
  props: ComponentProps<typeof ThreeCanvasComponent>
) {
  return (
    <ClientOnly
      fallback={
        <div className="relative size-full">
          <SceneSpinner />
        </div>
      }
    >
      <ThreeCanvasComponent {...props} />
    </ClientOnly>
  );
}
