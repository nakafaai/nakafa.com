"use client";

import { useMediaQuery } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { hasHardwareWebGL } from "@repo/design-system/lib/device";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

/**
 * Loads the dithering artwork only when the entry page shows it. Its library
 * stays out of the entry routes' first JavaScript, and nothing stands in while
 * it loads.
 */
const DeferredDithering = dynamic(
  () =>
    import("@/components/marketing/about/features.client").then(
      (module) => module.FeaturesDithering
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

/**
 * Renders the theme-aware dithering on wide screens, where the layout shows it,
 * and only when the browser can draw WebGL2 on a GPU. Until the client has
 * measured both, the box stays empty, so the page neither waits for nor shows
 * a placeholder.
 */
export function EntryShellArtwork() {
  const isLargeScreen = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  return (
    <div className="relative col-span-4 hidden lg:block">
      {isLargeScreen ? <HardwareDithering /> : null}
    </div>
  );
}

/**
 * Probes WebGL only on wide screens, so a phone never creates a context. A
 * failed load of the artwork leaves the panel plain instead of replacing the
 * sign-in page, and the boundary reports the failure.
 */
function HardwareDithering() {
  const hasWebGL = useSyncExternalStore(
    subscribeNever,
    hasHardwareWebGL,
    withoutWebGL
  );

  if (!hasWebGL) {
    return null;
  }

  return (
    <ErrorBoundary fallback={null}>
      <DeferredDithering />
    </ErrorBoundary>
  );
}

/** The probe's answer does not change once it is known. */
function subscribeNever() {
  return () => undefined;
}

/** The server cannot probe WebGL, so its markup never draws the artwork. */
function withoutWebGL() {
  return false;
}
