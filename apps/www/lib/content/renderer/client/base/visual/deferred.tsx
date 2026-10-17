"use client";

import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
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

/** The ids of the card's title and description, which name the figure. */
interface FigureNames {
  readonly "aria-describedby": string;
  readonly "aria-labelledby": string;
}

/**
 * Loads the WebGL implementation shortly before the visual enters view. The
 * figure is the card's body, so the loading frame and the scene share it.
 */
export function DeferredMathScene({
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  ...props
}: MathSceneProps & FigureNames) {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <VisualCardBody
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className="relative m-0"
      data-slot="math-scene"
      render={<figure />}
    >
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      {shouldRender ? <MathScene {...props} /> : <ScenePlaceholder />}
    </VisualCardBody>
  );
}
