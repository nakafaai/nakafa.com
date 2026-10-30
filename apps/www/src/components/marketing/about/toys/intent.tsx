import { useMounted } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { lazy, Suspense } from "react";

/**
 * The toy layer's code, which stays out of the page's first JavaScript. Its
 * import starts when the layer is first rendered.
 */
const HomeToyLayer = lazy(() =>
  import("@/components/marketing/about/toys/layer").then((module) => ({
    default: module.HomeToyLayer,
  }))
);

/**
 * Mounts the toys as soon as React has taken the page over, so they come on
 * screen with the page and never wait for a scroll, a pointer or a touch. A
 * toy needs the live layout to find its place, so the server draws none. A
 * layer that fails to load leaves the page as it is, and its absence never
 * reaches the error page.
 */
export function HomeToys() {
  const mounted = useMounted();

  if (!mounted) {
    return null;
  }

  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Suspense fallback={null}>
          <HomeToyLayer />
        </Suspense>
      </Suspense>
    </ErrorBoundary>
  );
}
