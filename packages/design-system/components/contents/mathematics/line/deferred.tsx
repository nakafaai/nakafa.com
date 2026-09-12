"use client";

import type { LineSceneProps } from "@repo/design-system/components/contents/mathematics/line/spec";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { lazy, Suspense, useState } from "react";

function ScenePlaceholder() {
  return (
    <div
      aria-hidden="true"
      className={threeSceneFrameVariants({
        className: "grid place-items-center",
      })}
    >
      <Spinner className="size-6" />
    </div>
  );
}

// The intersection gate keeps WebGL off the server. React owns this lazy
// boundary without adding a nested Next.js preload for the same scene.
const LineScene = lazy(() =>
  import("@repo/design-system/components/contents/mathematics/line/scene").then(
    (module) => ({ default: module.LineScene })
  )
);

/** Loads the WebGL scene shortly before its card enters the viewport. */
export function DeferredLineScene(props: LineSceneProps) {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <div className="relative" data-slot="line-scene">
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      <Suspense fallback={<ScenePlaceholder />}>
        {shouldRender ? <LineScene {...props} /> : <ScenePlaceholder />}
      </Suspense>
    </div>
  );
}
