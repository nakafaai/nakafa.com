"use client";

import { Sad02Icon } from "@hugeicons/core-free-icons";
import { useIntersection } from "@mantine/hooks";
import { AdaptiveDpr } from "@react-three/drei";
import {
  Canvas,
  type CanvasProps,
  useFrame,
  useStore,
} from "@react-three/fiber";
import { CameraFraming } from "@repo/design-system/components/three/camera/framing";
import { THREE_RENDER_MARGIN } from "@repo/design-system/components/three/data/constants";
import { Button } from "@repo/design-system/components/ui/button";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { getPowerPreference } from "@repo/design-system/lib/device";
import { cn } from "cn";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  const t = useTranslations("Error");
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
      <div className="space-y-4 text-center">
        <h1 className="font-bold font-mono text-2xl text-primary">5XX</h1>

        <div className="space-y-2">
          <h2 className="font-medium tracking-tight">{t("title")}</h2>

          <p className="mx-auto max-w-md text-muted-foreground text-sm">
            {errorMessage}
          </p>
        </div>

        <div className="mx-auto grid w-fit grid-cols-2 gap-2">
          <Button onClick={resetErrorBoundary} size="sm" variant="secondary">
            {t("retry")}
          </Button>
          <a
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            href="https://github.com/nakafaai/nakafa.com/issues"
            rel="noopener noreferrer"
            target="_blank"
            title={t("report")}
          >
            {t("report")}
          </a>
        </div>
      </div>
    </div>
  );
}

/** Runs scene time before every other frame callback. */
const SCENE_TIME_PRIORITY = Number.NEGATIVE_INFINITY;

/**
 * Keeps scene time continuous while a canvas pauses.
 *
 * Fiber restarts `clock.elapsedTime` at zero whenever the frameloop changes,
 * and still draws frames invalidated just before a pause on manual-advance
 * time. Scenes animate from elapsed time, some from start times read from it,
 * so those paused frames hold the last rendered time and a resumed canvas
 * continues from it.
 *
 * @see https://r3f.docs.pmnd.rs/api/canvas
 */
function SceneTime() {
  const store = useStore();
  const elapsed = useRef(0);

  useFrame(({ clock, frameloop }) => {
    if (frameloop === "never") {
      clock.elapsedTime = elapsed.current;
      return;
    }
    elapsed.current = clock.elapsedTime;
  }, SCENE_TIME_PRIORITY);

  useLayoutEffect(
    () =>
      store.subscribe((state, previous) => {
        if (
          state.frameloop === previous.frameloop ||
          state.frameloop === "never"
        ) {
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
 * Shared Three.js canvas with a WebGL fallback and render error boundary.
 *
 * Selects an appropriate GPU power preference and lets React Three Fiber own
 * capability detection through its Canvas fallback. A canvas farther than
 * `THREE_RENDER_MARGIN` from the viewport stops rendering and resumes when it
 * returns, so animated scenes cost nothing while nobody can see them.
 *
 * @param children - React Three.js children to render
 * @param frameloop - Frame update strategy ("always" | "demand")
 * @param props - Additional CanvasProps passed to @react-three/fiber Canvas
 *
 * @returns JSX element with WebGL detection and error handling
 */
function ThreeCanvasComponent({
  children,
  className,
  frameloop = "demand",
  ...props
}: {
  children: ReactNode;
  frameloop?: "always" | "demand";
} & Omit<CanvasProps, "camera" | "orthographic">) {
  const powerPreference = getPowerPreference();
  const [canvasKey, setCanvasKey] = useState(0);
  const { entry, ref } = useIntersection<HTMLDivElement>({
    rootMargin: `${THREE_RENDER_MARGIN}px`,
  });
  // A canvas renders until the observer first places it.
  const nearViewport = entry?.isIntersecting ?? true;

  /**
   * Next.js Cache Components can preserve recently visited routes with React
   * Activity. Activity keeps the DOM hidden, but it disconnects effects while
   * hidden and reconnects them when visible again. WebGL renderers are external
   * resources owned by React Three Fiber, so the safest shared behavior is to
   * remount only the Canvas after a route has been hidden.
   *
   * @see https://nextjs.org/docs/app/guides/preserving-ui-state
   * @see https://react.dev/reference/react/Activity
   * @see https://r3f.docs.pmnd.rs/api/canvas
   */
  useLayoutEffect(
    () => () => {
      setCanvasKey((key) => key + 1);
    },
    []
  );

  return (
    <div className="size-full rounded-[inherit]" ref={ref}>
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <ErrorFallback
            error={error}
            resetErrorBoundary={resetErrorBoundary}
          />
        )}
      >
        <Canvas
          className={cn(
            "size-full overflow-hidden rounded-[inherit] [&>div]:rounded-[inherit] [&_canvas]:size-full [&_canvas]:rounded-[inherit]",
            className
          )}
          dpr={[1, 2]}
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <HugeIcons
                aria-hidden="true"
                className="size-4 shrink-0"
                icon={Sad02Icon}
              />
            </div>
          }
          frameloop={nearViewport ? frameloop : "never"}
          gl={{
            antialias: true,
            powerPreference,
            alpha: true,
          }}
          key={canvasKey}
          performance={{
            min: 0.8,
            max: 1.0,
            debounce: 100,
          }}
          shadows="percentage"
          {...props}
        >
          <AdaptiveDpr />
          <SceneTime />
          <CameraFraming>{children}</CameraFraming>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

export const ThreeCanvas = dynamic(
  () => Promise.resolve(ThreeCanvasComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner aria-hidden="true" className="size-6" />
      </div>
    ),
  }
);
