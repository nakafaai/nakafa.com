"use client";

import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import dynamic from "next/dynamic";
import { useState } from "react";

import type { MathSceneProps } from "@/lib/content/renderer/client/base/visual/render";

const MathScene = dynamic(
  () =>
    import("@/lib/content/renderer/client/base/visual/render").then(
      ({ MathScene: Scene }) => Scene
    ),
  { loading: ScenePlaceholder, ssr: false }
);

/**
 * Loads the WebGL implementation shortly before the visual enters view, inside
 * the body that holds the figure, so the loading frame and the scene share it.
 */
export function DeferredMathScene(props: MathSceneProps) {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <>
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      {shouldRender ? <MathScene {...props} /> : <ScenePlaceholder />}
    </>
  );
}
