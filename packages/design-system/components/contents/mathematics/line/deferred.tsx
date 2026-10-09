"use client";

import type { LineSceneProps } from "@repo/design-system/components/contents/mathematics/line/scene";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { VisualCardScene } from "@repo/design-system/components/visual/card";
import dynamic from "next/dynamic";
import { useState } from "react";

const LineScene = dynamic(
  () =>
    import(
      "@repo/design-system/components/contents/mathematics/line/scene"
    ).then((module) => module.LineScene),
  {
    loading: ScenePlaceholder,
    ssr: false,
  }
);

/** Loads the WebGL scene shortly before its card enters the viewport. */
export function DeferredLineScene(props: LineSceneProps) {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <VisualCardScene className="relative" data-slot="line-scene">
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      {shouldRender ? <LineScene {...props} /> : <ScenePlaceholder />}
    </VisualCardScene>
  );
}
