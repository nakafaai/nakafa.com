"use client";

import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

const LineScene = lazy(async () => ({
  default: await (() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/scene"
    ).then((module) => module.LineScene))(),
}));

/** Loads the WebGL scene shortly before its card enters the viewport. */
export function DeferredLineScene() {
  const [shouldRender, setShouldRender] = useState(false);

  return (
    <VisualCardBody className="relative" data-scene="line">
      {shouldRender ? (
        <Suspense fallback={<ScenePlaceholder />}>
          <ClientOnly fallback={<ScenePlaceholder />}>
            <LineScene />
          </ClientOnly>
        </Suspense>
      ) : (
        <ScenePlaceholder />
      )}
      {/* Last, so the scene or its stand-in is the body's first child and draws no second divider. */}
      <Intersection
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        once
        onIntersect={() => setShouldRender(true)}
      />
    </VisualCardBody>
  );
}
