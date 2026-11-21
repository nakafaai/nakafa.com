import {
  ScenePlaceholder,
  SceneStill,
} from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
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
 * a pointer move, a touch or a key). The scene, three.js and Fiber are the
 * largest part of a lesson's JavaScript: seven scripts and 1,064,878 decoded
 * bytes of the 4,045,711 the measured lesson loaded, so a lesson whose first
 * visual stands on its first screen no longer loads them before anyone reads
 * it. Until then the card shows the scene's still (`MathPicture`), which the
 * server draws, so a crawler, Lighthouse and a reader who never moves see the
 * true picture.
 *
 * The card listens for the gesture from the moment it mounts, so the scroll
 * that brings it near is the gesture that loads it. Once the scene loads, the
 * still stays under a centred spinner until the scene's first whole frame
 * (`SceneStill`, `ThreeCanvas`), and the frame never changes size.
 */
export function DeferredMathScene(props: MathSceneProps) {
  const [near, setNear] = useState(false);
  const [intent, setIntent] = useState(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const wait = Effect.runFork(
      untilReaderGesture.pipe(
        Effect.andThen(Effect.sync(() => setIntent(true)))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(wait));
    };
  }, []);

  const active = near && intent;

  return (
    <SceneStill onDrawn={() => setDrawn(true)} still={null}>
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
