"use client";

import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import dynamic from "next/dynamic";
import { useState } from "react";

import type { MathSceneProps } from "@/lib/content/renderer/client/base/visual/render";

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

const MathScene = dynamic(
  () =>
    import("@/lib/content/renderer/client/base/visual/render").then(
      ({ MathScene: Scene }) => Scene
    ),
  { loading: ScenePlaceholder, ssr: false }
);

/** Loads the WebGL implementation shortly before the visual enters view. */
export function DeferredMathScene(props: MathSceneProps) {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <div className="relative" data-slot="math-scene">
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      {shouldRender ? <MathScene {...props} /> : <ScenePlaceholder />}
    </div>
  );
}
