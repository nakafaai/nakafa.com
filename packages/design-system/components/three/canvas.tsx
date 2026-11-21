import {
  useIntersection,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import type { CanvasProps } from "@react-three/fiber";
import {
  addAfterEffect,
  addEffect,
  Canvas,
  useFrame,
  useStore,
  useThree,
} from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraFraming } from "@repo/design-system/components/three/camera/framing";
import { THREE_RENDER_MARGIN } from "@repo/design-system/components/three/data/constants";
import {
  SCENE_STARTS,
  SceneFailure,
} from "@repo/design-system/components/three/failure";
import {
  SceneOverlay,
  SceneOverlayProvider,
} from "@repo/design-system/components/three/overlay";
import {
  SceneSpinner,
  useNotifySceneDrawn,
} from "@repo/design-system/components/three/placeholder";
import { SceneDrawn } from "@repo/design-system/components/three/reveal";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  useHasVisualCard,
  useStartVisualScene,
  useVisualReset,
  useVisualScene,
} from "@repo/design-system/components/visual/card";
import {
  getCanvasDpr,
  getPowerPreference,
} from "@repo/design-system/lib/device";
import { createFramePace } from "@repo/design-system/lib/pace";
import { ClientOnly } from "@tanstack/react-router";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ToneMapping, WebGLRenderer } from "three";

/**
 * Keeps scene time continuous while a canvas pauses.
 *
 * Fiber restarts `clock.elapsedTime` at zero whenever the frameloop changes,
 * and scenes animate from that time, some from start times read from it, so a
 * resumed canvas restores the last rendered time. Fiber would also still draw
 * frames invalidated just before a pause on manual-advance time, where a
 * millisecond timestamp becomes the frame delta and throws every delta-driven
 * animation forward, so pausing drops those frames.
 *
 * @see https://r3f.docs.pmnd.rs/api/canvas
 */
function SceneTime({ controlled }: { readonly controlled: boolean }) {
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

/**
 * Draws a scene that animates by its own clock at the pace `createFramePace` keeps, an eighth of the main thread at
 * most (ADR 0039 D5). Fiber's own loop draws every frame of the display, so a lab near the first screen held a slow
 * phone's main thread for as long as the page loaded: on the relative movement lesson, three.js ran 1.6 to 1.8 seconds
 * of script in a 12x Lighthouse run. The canvas renders on demand instead, and this asks for the next frame only
 * once the pace says it is due: a fast device still draws every frame, and a slow phone draws a few each second.
 * Fiber's global effects bracket each frame it renders, so the rest counts the frame's whole cost, its paint
 * included.
 */
function PacedFrames() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const pace = createFramePace();
    let startedAt = 0;
    let request = 0;
    const stopBefore = addEffect(() => {
      startedAt = performance.now();
    });
    const stopAfter = addAfterEffect(() => pace.rest(startedAt));
    const tick = (now: number) => {
      if (pace.isDue(now)) {
        invalidate();
      }
      request = requestAnimationFrame(tick);
    };
    invalidate();
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      stopBefore();
      stopAfter();
    };
  }, [invalidate]);

  return null;
}

/**
 * Calls back whenever an element of the page turns inert or interactive
 * again, such as the page behind a visual card shown full screen.
 */
function subscribeToInert(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    attributeFilter: ["inert"],
    subtree: true,
  });
  return () => observer.disconnect();
}

/**
 * Starts the scene again on a new canvas when the browser takes its WebGL
 * context away and does not give it back, as WebKit does to the oldest context
 * once a page holds sixteen. three keeps a lost context waiting for its
 * restore, which never comes then, so the scene would stay blank.
 */
function watchContextLoss(gl: WebGLRenderer, onLost: () => void) {
  gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
}

/**
 * Shared Three.js canvas: one scene in a frame that keeps its size from the
 * first paint to the scene's first frame, with its loading state in the middle.
 *
 * The canvas element is created only once its frame nears the viewport, in
 * the same commit that asks it for WebGL: Mobile Safari refused WebGL to a
 * lab canvas that had waited in the page for twelve seconds without a context,
 * and showed the reader an error, while a new canvas beside it got WebGL 2 at
 * once. A canvas whose start fails anyway starts again on a new element
 * (`SceneFailure`), and one whose context the browser takes away starts again
 * the next time its frame nears the viewport.
 *
 * Until the scene is drawn whole (`SceneDrawn`), the frame shows its loading
 * state: the scene's still when it has one, and a spinner in the middle. The
 * canvas and its labels stay transparent and take no presses behind it, and
 * the frame swaps them in one commit, so a reader never sees an empty canvas, a
 * half-built scene or a camera that jumps.
 *
 * A canvas farther than `THREE_RENDER_MARGIN` from the viewport stops
 * rendering and resumes when it returns, so animated scenes cost nothing while
 * nobody can see them. A canvas in an inert part of the page, such as the page
 * behind a visual card shown full screen, stops the same way. Scene labels draw
 * in a DOM overlay over the same frame, so they need no React root of their own.
 *
 * With reduced motion every canvas renders on demand, whatever loop it asks
 * for: a scene is drawn once, and again only when the reader moves the camera.
 * A scene that animates by its own clock keeps its still pose in that case.
 * Otherwise such a scene draws at the pace of `PacedFrames`, never on every
 * frame of the display.
 *
 * @param children - React Three.js children to render
 * @param frameloop - Frame update strategy ("always" | "demand")
 * @param toneMapping - How the canvas maps light to screen colors, ACES unless
 * a stage names another
 * @param props - Additional CanvasProps passed to @react-three/fiber Canvas
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
  const powerPreference = getPowerPreference();
  const dpr = getCanvasDpr();
  const notifyDrawn = useNotifySceneDrawn();
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
  // The frame is placed once it nears the viewport, and its canvas starts then.
  const [placed, setPlaced] = useState(false);
  // Each start of the scene draws on a new canvas element.
  const [startCount, setStartCount] = useState(1);
  const [stage, setStage] = useState<"drawn" | "failed" | "loading">("loading");
  const drawn = stage === "drawn";
  const nearViewport = entry?.isIntersecting ?? true;
  const paced = hasCard ? playing : !calm && frameloop === "always";
  const behindInert = useSyncExternalStore(
    subscribeToInert,
    () => Boolean(frame?.closest("[inert]")),
    () => false
  );
  const running = nearViewport && !behindInert;

  // Continuous-motion labs (`frameloop="always"`) start playing once on their
  // first drawn frame unless reduced motion is set, just like P5Sketch, so the
  // card's Pause button accurately reflects state and halts frame pacing.
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

  /** Starts the scene again on a new canvas, now. */
  const restart = () => {
    setStage("loading");
    setStartCount((count) => count + 1);
  };

  /** Starts the scene again on a new canvas, once its frame nears the viewport. */
  const replace = () => {
    setPlaced(false);
    restart();
  };

  return (
    // The loading state, the canvas and the overlay fill this frame.
    <div
      aria-busy={!drawn}
      className="relative size-full min-w-0 overflow-hidden rounded-[inherit]"
      data-scene-state={stage}
      ref={frameRef}
    >
      {placed ? (
        <div
          className={cn("size-full", !drawn && "pointer-events-none opacity-0")}
        >
          <SceneOverlayProvider>
            <ErrorBoundary
              fallbackRender={() => null}
              key={startCount}
              onError={() => {
                if (startCount < SCENE_STARTS) {
                  restart();
                  return;
                }
                setStage("failed");
              }}
            >
              <Canvas
                className={cn(
                  "size-full overflow-hidden rounded-[inherit] [&_canvas]:size-full [&_canvas]:rounded-[inherit] [&>div]:rounded-[inherit]",
                  className
                )}
                dpr={dpr}
                frameloop={running ? "demand" : "never"}
                gl={{
                  antialias: true,
                  powerPreference,
                  alpha: true,
                  toneMapping,
                }}
                onCreated={(state) => {
                  watchContextLoss(state.gl, replace);
                  onCreated?.(state);
                }}
                shadows="percentage"
                {...props}
              >
                <SceneTime controlled={hasCard} />
                {paced && running ? <PacedFrames /> : null}
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
        </div>
      ) : (
        <Intersection
          aria-hidden="true"
          className="absolute inset-0"
          key={startCount}
          once
          onIntersect={() => setPlaced(true)}
          rootMargin={`${THREE_RENDER_MARGIN}px`}
        />
      )}
      {stage === "loading" ? <SceneSpinner /> : null}
      {stage === "failed" ? <SceneFailure onRestart={restart} /> : null}
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
