import { ClientOnly } from "@tanstack/react-router";
import { type ComponentProps, lazy, Suspense } from "react";

/**
 * Loads the local preview listener only where a preview layout renders it. A
 * Client Component that a layout imports is part of every route's first
 * JavaScript, and a production layout never renders this one.
 */
const LazyDeferredPreviewRefresh = lazy(() =>
  import("@/components/dev/refresh").then((module) => ({
    default: module.PreviewRefresh,
  }))
);

export function DeferredPreviewRefresh(
  props: ComponentProps<typeof LazyDeferredPreviewRefresh>
) {
  return (
    <Suspense fallback={null}>
      <ClientOnly fallback={null}>
        <LazyDeferredPreviewRefresh {...props} />
      </ClientOnly>
    </Suspense>
  );
}
