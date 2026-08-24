"use client";

import type { LineSceneProps } from "@repo/design-system/components/contents/mathematics/line/spec";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import dynamic from "next/dynamic";
import { useState } from "react";

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
    <div className="relative">
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
      {shouldRender ? <LineScene {...props} /> : <ScenePlaceholder />}
    </div>
  );
}
