import {
  ScenePlaceholder,
  SceneStill,
} from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { isWebGLAvailable } from "@repo/design-system/lib/device";
import { lazy } from "@repo/design-system/lib/lazy";
import { untilReaderGesture } from "@repo/design-system/lib/settle";
import { ClientOnly } from "@tanstack/react-router";
import { Effect, Fiber } from "effect";
import { Suspense, useEffect, useState } from "react";
import { MathPicture } from "@/lib/content/renderer/client/base/visual/picture";
import type { MathSceneProps } from "@/lib/content/renderer/client/base/visual/render";

const MathScene = lazy(() =>
  import("@/lib/content/renderer/client/base/visual/render").then((module) => ({
    default: module.MathScene,
  }))
);

/**
 * Loads the WebGL implementation once the reader shows intent: the visual is
 * about to enter view and the reader has made a gesture on the page (a scroll,
 * a pointer move, a touch or a key). Until then the card shows the scene's
 * still (`MathPicture`), which the server draws.
 *
 * When WebGL is unavailable or blocked (such as Safari Lockdown Mode) or fails
 * after retries, the card stays on the crisp server-drawn `MathPicture` without
 * covering it with an error overlay. When an off-screen canvas is temporarily
 * released by the WebGL context pool, the still stands seamlessly underneath
 * until the canvas re-acquires a slot and redraws.
 */
export function DeferredMathScene(props: MathSceneProps) {
  const [near, setNear] = useState(false);
  const [intent, setIntent] = useState(false);
  const [status, setStatus] = useState<"drawn" | "fallback" | "idle">("idle");

  useEffect(() => {
    const wait = Effect.runFork(
      untilReaderGesture.pipe(
        Effect.andThen(
          Effect.sync(() => {
            setIntent(true);
            if (!isWebGLAvailable()) {
              setStatus("fallback");
            }
          })
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(wait));
    };
  }, []);

  const active = near && intent && status !== "fallback";
  const drawn = status === "drawn";

  return (
    <SceneStill
      onDrawn={() => setStatus("drawn")}
      onFailed={() => setStatus("fallback")}
      onLoading={() => {
        setStatus((current) => (current === "fallback" ? "fallback" : "idle"));
      }}
      still={null}
    >
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setNear(true)}
      />
      {drawn ? null : (
        <div
          className={
            active ? "pointer-events-none absolute inset-0" : "size-full"
          }
        >
          <MathPicture {...props} />
        </div>
      )}
      {active ? (
        <Suspense fallback={<ScenePlaceholder />}>
          <ClientOnly fallback={<ScenePlaceholder />}>
            <MathScene {...props} />
          </ClientOnly>
        </Suspense>
      ) : null}
    </SceneStill>
  );
}
