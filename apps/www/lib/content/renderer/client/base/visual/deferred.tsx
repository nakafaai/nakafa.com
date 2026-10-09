"use client";

import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { VisualCardScene } from "@repo/design-system/components/visual/card";
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

/** Loads the WebGL implementation shortly before the visual enters view. */
export function DeferredMathScene(props: MathSceneProps) {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <VisualCardScene className="relative" data-slot="math-scene">
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      {shouldRender ? <MathScene {...props} /> : <ScenePlaceholder />}
    </VisualCardScene>
  );
}
