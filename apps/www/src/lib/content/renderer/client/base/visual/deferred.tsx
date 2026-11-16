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
 * true picture, and the scene takes its place in the same frame once loaded.
 */
export function DeferredMathScene(props: MathSceneProps) {
  const [near, setNear] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!near) {
      return;
    }
    const intent = Effect.runFork(
      untilReaderGesture.pipe(
        Effect.andThen(Effect.sync(() => setShouldRender(true)))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(intent));
    };
  }, [near]);

  return (
    <>
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setNear(true)}
      />
      {shouldRender ? (
        <Suspense fallback={<MathPicture {...props} />}>
          <ClientOnly fallback={<MathPicture {...props} />}>
            <MathScene {...props} />
          </ClientOnly>
        </Suspense>
      ) : (
        <MathPicture {...props} />
      )}
    </>
  );
}
