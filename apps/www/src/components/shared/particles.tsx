import { ClientOnly } from "@tanstack/react-router";
import { type ComponentProps, lazy, Suspense } from "react";

/**
 * Loads the decorative particle field after the page it decorates has
 * rendered. Error boundaries are part of every route's first JavaScript, and
 * the field is only drawn once one of them shows.
 */
const LazyDeferredParticles = lazy(() =>
  import("@repo/design-system/components/ui/particles").then((module) => ({
    default: module.Particles,
  }))
);

export function DeferredParticles(
  props: ComponentProps<typeof LazyDeferredParticles>
) {
  return (
    <Suspense fallback={null}>
      <ClientOnly fallback={null}>
        <LazyDeferredParticles {...props} />
      </ClientOnly>
    </Suspense>
  );
}
