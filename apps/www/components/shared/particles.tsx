"use client";

import dynamic from "next/dynamic";

/**
 * Loads the decorative particle field after the page it decorates has
 * rendered. Error boundaries are part of every route's first JavaScript, and
 * the field is only drawn once one of them shows.
 */
export const DeferredParticles = dynamic(
  () =>
    import("@repo/design-system/components/ui/particles").then(
      (module) => module.Particles
    ),
  {
    loading: () => null,
    ssr: false,
  }
);
