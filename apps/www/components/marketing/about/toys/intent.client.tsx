"use client";

import { useWindowEvent } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import dynamic from "next/dynamic";
import { Suspense, useState } from "react";

/**
 * The toy layer's code. Its import starts only when the layer is first rendered,
 * which happens once the reader has acted on the page.
 */
const HomeToyLayer = dynamic(() =>
  import("@/components/marketing/about/toys/layer.client").then(
    (module) => module.HomeToyLayer
  )
);

/**
 * Mounts the toys at the reader's first scroll, pointer movement or touch on the
 * page. Until then the page holds no toy and downloads none of their code. A
 * layer that fails to load leaves the page as it is, and its absence never
 * reaches the error page.
 */
export function HomeToys() {
  const [reached, setReached] = useState(false);

  useWindowEvent("scroll", () => setReached(true), { passive: true });
  useWindowEvent("pointermove", () => setReached(true), { passive: true });
  useWindowEvent("touchstart", () => setReached(true), { passive: true });

  if (!reached) {
    return null;
  }

  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <HomeToyLayer />
      </Suspense>
    </ErrorBoundary>
  );
}
